/**
 * Backfill availability slots derived from users' real play history.
 *
 * WHY
 * ---
 * 87,696 availability docs have zero slots. A zero-slot doc is deleted from the
 * Algolia index by syncAvailabilityToAlgolia.js, so the user receives ZERO game
 * invitations, silently and permanently. Most of those docs were created empty by
 * the May 2026 createAvailabilities.js migration (users with no `alerts` doc to
 * convert from), and the rest by onboarding defects (see ONBOARDING_TIMESLOTS_BRIEF.md).
 *
 * These are not people who declined to share availability. Many are core players:
 * of the MAU-30 zero-slot cohort, 76.4% have played a real game and a third have
 * played 11+. We already know when they play, from `games`.
 *
 * WHAT IT DOES
 * ------------
 * For every user with no indexable availability, derive their slots from the local
 * kick-off time of games they actually attended or organised, and write them onto
 * their existing zero-slot docs. Writing `slots` fires the Algolia trigger, which
 * indexes the doc, which makes the user invitable again.
 *
 * Derived slots are tagged `slots_origin: 'derived-from-play-history'` plus a
 * `slots_derived_at` timestamp, so this is auditable and fully reversible
 * (see --revert). User-chosen slots are never touched: any doc with a non-empty
 * `slots` array is skipped unconditionally.
 *
 * SAFETY
 * ------
 * - Dry-run by default. --apply is required to write.
 * - Skips docs whose location was faked by the migration ('defaulted-paris'):
 *   inviting someone to Paris on a coordinate they never chose is worse than
 *   leaving them uninvited.
 * - Skips banned / pro / test / disabled users and $RCAnonymousID junk docs.
 * - Caps slots per doc (default 12, most frequent first) so a heavy player does
 *   not read as permanently free, which would degrade match quality for everyone.
 * - Writes in bounded batches with a BulkWriter error handler.
 *
 * USAGE
 * -----
 *   node backfill_derived_availability_slots.js                    # dry run, all-time
 *   node backfill_derived_availability_slots.js --active-days=180  # narrow the cohort
 *   node backfill_derived_availability_slots.js --cap=12
 *   node backfill_derived_availability_slots.js --limit=200 --apply # small live test
 *   node backfill_derived_availability_slots.js --apply
 *   node backfill_derived_availability_slots.js --revert --apply    # undo everything
 *
 * Run --limit=200 --apply first and check Algolia picked those up before the full run.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});
const db = admin.firestore();

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const REVERT = args.includes('--revert');
const numArg = (name, dflt) => {
  const a = args.find(x => x.startsWith(`--${name}=`));
  return a ? parseInt(a.split('=')[1], 10) : dflt;
};
const CAP = numArg('cap', 12);
// null = all-time (every user with an unindexable doc, regardless of last activity)
const ACTIVE_DAYS = numArg('active-days', null);
const LIMIT = numArg('limit', null);

// Slots derived from a habit this old are close to fiction. We still write them
// (the user may well still play the same weeknight) but tag them so notification
// sends can hold this group back separately.
const STALE_HISTORY_DAYS = 730;

const DERIVED_ORIGIN = 'derived-from-play-history';
const EXCLUDED_TYPES = new Set(['pro', 'super_pro', 'test', 'disabled', 'wrong_pro', 'admin']);

const NOW = new Date();
const daysAgo = d => (d ? (NOW - d) / 86400000 : null);

// ---------------------------------------------------------------------------
// Slot derivation
// ---------------------------------------------------------------------------

/**
 * Convert a game's UTC kick-off into the app's slot format: `<weekday>-<HH:MM>`,
 * weekday 1..7 (Monday=1), snapped to the 30-minute grid the picker uses.
 * Matches cloud-functions/functions/shared/availabilityMatching.js.
 *
 * The venue's own timezone is what matters: a 19:00 game in Miami and a 19:00
 * game in Paris are both "1-19:00" to the player who shows up.
 */
const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function toSlot(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timeZone || 'Europe/Paris',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const o = {};
    for (const p of parts) o[p.type] = p.value;

    const weekday = WEEKDAYS[o.weekday];
    if (!weekday) return null;

    let hour = parseInt(o.hour, 10);
    const minute = parseInt(o.minute, 10);
    if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

    // Snap to the nearest half hour, rolling the hour (and weekday) if needed.
    let snapped = 0;
    if (minute >= 45) {
      hour = (hour + 1) % 24;
      if (hour === 0) return null; // rolled past midnight; day would change too
    } else if (minute >= 15) {
      snapped = 30;
    }

    const hh = String(hour).padStart(2, '0');
    const mm = String(snapped).padStart(2, '0');
    return `${weekday}-${hh}:${mm}`;
  } catch (e) {
    return null;
  }
}

/** Most-frequent-first, capped. Ties broken by slot string for determinism. */
function topSlots(counts, cap) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, cap)
    .map(([slot]) => slot);
}

// ---------------------------------------------------------------------------
// Paging helper — __name__ cursor needs no composite index and is stable
// ---------------------------------------------------------------------------
async function scan(collection, onDoc, pageSize = 2000) {
  let last = null;
  let seen = 0;
  for (;;) {
    let q = db.collection(collection).orderBy('__name__').limit(pageSize);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const doc of snap.docs) onDoc(doc);
    seen += snap.size;
    last = snap.docs[snap.docs.length - 1].id;
    if (seen % 50000 === 0) console.log(`    ...${collection}: ${seen.toLocaleString()}`);
    if (snap.size < pageSize) break;
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Revert
// ---------------------------------------------------------------------------
async function revert() {
  console.log('REVERT: clearing every slot set by this backfill.\n');
  const targets = [];
  await scan('availabilities', doc => {
    if (doc.data().slots_origin === DERIVED_ORIGIN) targets.push(doc.id);
  });
  console.log(`Docs tagged '${DERIVED_ORIGIN}': ${targets.length.toLocaleString()}`);
  if (!targets.length) return;
  if (!APPLY) {
    console.log('\nDRY RUN. Re-run with --revert --apply to clear them.');
    return;
  }
  const writer = db.bulkWriter();
  writer.onWriteError(err => err.failedAttempts < 3);
  for (const id of targets) {
    // Deleting `slots` (rather than writing []) matches what the app's own
    // "clear my slots" affordance does, and the Algolia trigger treats a
    // missing array as empty and de-indexes the doc.
    writer.update(db.collection('availabilities').doc(id), {
      slots: admin.firestore.FieldValue.delete(),
      slots_origin: admin.firestore.FieldValue.delete(),
      slots_derived_at: admin.firestore.FieldValue.delete(),
      slots_derived_stale: admin.firestore.FieldValue.delete(),
    });
  }
  await writer.close();
  console.log(`Cleared ${targets.length.toLocaleString()} docs. Algolia de-indexes them via the trigger.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('='.repeat(72));
  console.log('Derived availability backfill');
  console.log(`mode: ${APPLY ? 'APPLY (writes)' : 'DRY RUN'} | cap: ${CAP} slots/doc`);
  console.log(`cohort: ${ACTIVE_DAYS ? `active within ${ACTIVE_DAYS}d` : 'all-time (any last_activity)'}`);
  if (LIMIT) console.log(`limit: ${LIMIT} users`);
  console.log('='.repeat(72) + '\n');

  if (REVERT) return revert();

  // --- 1. Users we are allowed to touch ------------------------------------
  console.log('[1/4] Loading users...');
  const eligible = new Map(); // uid -> { lastActivity }
  let skippedUsers = 0;
  await scan('users', doc => {
    const uid = doc.id;
    if (uid.startsWith('$RCAnonymousID:')) { skippedUsers++; return; }
    const u = doc.data();
    if (u.banned === true || EXCLUDED_TYPES.has(u.type)) { skippedUsers++; return; }
    const lastActivity = u.last_activity_date && u.last_activity_date.toDate
      ? u.last_activity_date.toDate() : null;
    if (ACTIVE_DAYS !== null) {
      const d = daysAgo(lastActivity);
      if (d === null || d > ACTIVE_DAYS) { skippedUsers++; return; }
    }
    eligible.set(uid, { lastActivity });
  });
  console.log(`  eligible: ${eligible.size.toLocaleString()} (skipped ${skippedUsers.toLocaleString()})\n`);

  // --- 2. Their availability docs ------------------------------------------
  console.log('[2/4] Loading availabilities...');
  const zeroDocs = new Map();     // uid -> [{ id, origin }]
  const alreadyIndexed = new Set(); // uid with >=1 real slotted doc
  let fakeLocation = 0;
  await scan('availabilities', doc => {
    const a = doc.data();
    const uid = a.user_id;
    if (!uid || !eligible.has(uid)) return;

    const slots = Array.isArray(a.slots) ? a.slots : [];
    if (slots.length > 0) {
      // A user-chosen slot set. Never touch it — and if they have one anywhere,
      // they are already invitable and out of scope entirely.
      if (a.slots_origin !== DERIVED_ORIGIN) alreadyIndexed.add(uid);
      return;
    }

    // The migration invented a Paris coordinate for users it could not place.
    // Slots on a fake location would invite them to the wrong city.
    if (a.origin && a.origin.includes('defaulted-paris')) { fakeLocation++; return; }

    // The Algolia trigger dereferences data.location.latitude unguarded.
    if (!a.location) return;

    if (!zeroDocs.has(uid)) zeroDocs.set(uid, []);
    zeroDocs.get(uid).push({ id: doc.id, origin: a.origin || null });
  });
  for (const uid of alreadyIndexed) zeroDocs.delete(uid);
  console.log(`  users with an unindexable doc: ${zeroDocs.size.toLocaleString()}`);
  console.log(`  already invitable (skipped): ${alreadyIndexed.size.toLocaleString()}`);
  console.log(`  docs skipped for faked Paris location: ${fakeLocation.toLocaleString()}\n`);

  // --- 3. Derive slots from played games -----------------------------------
  console.log('[3/4] Deriving slots from played games...');
  const counts = new Map();     // uid -> { slot: n }
  const mostRecent = new Map(); // uid -> most recent play Date
  let gamesSeen = 0;

  await scan('games', doc => {
    const g = doc.data();
    gamesSeen++;
    if (g.status !== 'played') return;
    const date = g.date && g.date.toDate ? g.date.toDate() : null;
    if (!date) return;

    const slot = toSlot(date, g.time_zone);
    if (!slot) return;

    // Dedupe attendees: a +1 guest is the SAME user reference pushed twice, so
    // the raw array triple-counts. See FIRESTORE_ANALYTICS_GUIDE.md §2.
    const uids = new Set();
    for (const ref of g.attendees || []) {
      if (ref && ref.parent && ref.parent.id === 'users') uids.add(ref.id);
    }
    // The organizer picked the kick-off time; that is a real availability signal
    // even when they did not add themselves to the roster.
    if (typeof g.organizer === 'string' && g.organizer) uids.add(g.organizer);

    for (const uid of uids) {
      if (!zeroDocs.has(uid)) continue;
      if (!counts.has(uid)) counts.set(uid, {});
      const c = counts.get(uid);
      c[slot] = (c[slot] || 0) + 1;
      const prev = mostRecent.get(uid);
      if (!prev || date > prev) mostRecent.set(uid, date);
    }
  }, 1500);
  console.log(`  scanned ${gamesSeen.toLocaleString()} games`);
  console.log(`  users with derivable slots: ${counts.size.toLocaleString()}`);
  console.log(`  users with no play history (need an ask, not a backfill): ${(zeroDocs.size - counts.size).toLocaleString()}\n`);

  // --- 4. Plan the writes --------------------------------------------------
  console.log('[4/4] Planning writes...');
  const plan = [];
  const hist = { 0: 0 };
  let staleUsers = 0, docsTouched = 0, slotEntries = 0;

  const uids = [...counts.keys()].sort(); // deterministic --limit slice
  for (const uid of uids) {
    const slots = topSlots(counts.get(uid), CAP);
    if (!slots.length) continue;

    const recent = mostRecent.get(uid);
    const stale = daysAgo(recent) > STALE_HISTORY_DAYS;
    if (stale) staleUsers++;

    for (const doc of zeroDocs.get(uid)) {
      plan.push({ docId: doc.id, uid, slots, stale });
      docsTouched++;
      slotEntries += slots.length;
    }
    hist[slots.length] = (hist[slots.length] || 0) + 1;
    if (LIMIT && plan.length >= LIMIT) break;
  }

  const usersPlanned = new Set(plan.map(p => p.uid)).size;
  console.log(`  users to reactivate: ${usersPlanned.toLocaleString()}`);
  console.log(`  docs to write: ${docsTouched.toLocaleString()} (${(docsTouched / Math.max(usersPlanned, 1)).toFixed(2)} per user)`);
  console.log(`  slot-entries added to the index: ${slotEntries.toLocaleString()}`);
  console.log(`  avg slots/user: ${(slotEntries / Math.max(docsTouched, 1)).toFixed(1)}`);
  console.log(`  history older than ${STALE_HISTORY_DAYS}d (tagged slots_derived_stale): ${staleUsers.toLocaleString()}`);

  const buckets = Object.keys(hist).filter(k => hist[k] && k !== '0').sort((a, b) => a - b);
  console.log(`  slots-per-user distribution: ${buckets.map(k => `${k}:${hist[k]}`).join(' ')}`);

  console.log('\n  sample of 8 planned writes:');
  for (const p of plan.slice(0, 8)) {
    console.log(`    ${p.uid.slice(0, 12)}… doc ${p.docId.slice(0, 20)}… ${p.stale ? '[stale] ' : ''}${p.slots.slice(0, 6).join(', ')}${p.slots.length > 6 ? ` +${p.slots.length - 6}` : ''}`);
  }

  if (!APPLY) {
    console.log('\n' + '='.repeat(72));
    console.log('DRY RUN — nothing written. Re-run with --apply to write.');
    console.log('Suggested first live step: --limit=200 --apply, then check Algolia.');
    console.log('='.repeat(72));
    return;
  }

  console.log('\nWriting...');
  const writer = db.bulkWriter();
  writer.onWriteError(err => err.failedAttempts < 3);
  const stamp = admin.firestore.FieldValue.serverTimestamp();
  let written = 0;

  for (const p of plan) {
    writer.update(db.collection('availabilities').doc(p.docId), {
      slots: p.slots,
      slots_origin: DERIVED_ORIGIN,
      slots_derived_at: stamp,
      slots_derived_stale: p.stale,
      updated_at: stamp,
    });
    written++;
    if (written % 5000 === 0) {
      await writer.flush();
      console.log(`  ...${written.toLocaleString()} / ${plan.length.toLocaleString()}`);
    }
  }
  await writer.close();

  console.log(`\nDone. Wrote ${written.toLocaleString()} docs for ${usersPlanned.toLocaleString()} users.`);
  console.log('The Algolia trigger indexes each doc on write; expect the index to grow by');
  console.log(`~${docsTouched.toLocaleString()} records. Verify with diagnose_algolia_cap.js before announcing anything.`);
  console.log('To undo: --revert --apply');
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error('FAILED:', err); process.exit(1); });
