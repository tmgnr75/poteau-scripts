/**
 * Backfill `last_label` / `last_availability` for users hit by the e_area bug.
 *
 * THE BUG (fixed in poteau-app 1f4e082b, 2026-08-05)
 * --------------------------------------------------
 * The onboarding area step (`e_area_widget.dart`) auto-detected path wrote
 * `last_location` / `last_address` / `last_radius` on the user doc and created
 * an `availabilities` doc with `label: 'home'`, but never wrote `last_label`
 * or `last_availability` back onto the user. The address_picker path always
 * wrote both, which is why this only hit the auto-detect flow.
 *
 * Two visible symptoms, one root cause:
 *   1. Games header reads "(À définir)" -- `displayLabelYour('')` returns that
 *      literal string when `last_label` is empty.
 *   2. The locations bottom sheet greys out the user's only availability --
 *      it marks a row selected via `locationsItem.reference.id ==
 *      currentUserDocument.last_availability`, which matches nothing.
 *
 * WHO THIS TOUCHES
 * ----------------
 * Only users matching ALL of the e_area signature:
 *   - has >= 1 availabilities doc
 *   - newest availabilities doc has `label === 'home'`  (written by e_area)
 *   - `last_label` empty/absent
 *   - `last_availability` empty/absent
 *
 * Verified before writing: for all 318 matches, `users.last_address` equals
 * the newest availability's `city` exactly (318/318, 0 mismatches). The user
 * doc and that availability doc came from the same batch, so pointing
 * `last_availability` at it is a reconstruction, not a guess. The script
 * re-checks this invariant per user and SKIPS anyone who fails it.
 *
 * WHO THIS DELIBERATELY DOES NOT TOUCH
 * ------------------------------------
 *   - Users whose newest availability has a null/custom label. Those come from
 *     `availability_widget.dart`, where the label is free text via
 *     `reverseLabel()` -- blank means the user left the field blank. That is a
 *     user choice, not corruption, and 'home' would be fabricated data.
 *   - Users with a stale `last_availability` pointing at a deleted doc. That is
 *     a separate defect with a different fix; guessing a replacement could
 *     silently move someone's search area.
 *   - Users with no availabilities doc at all. Nothing to point at; they never
 *     completed the area step.
 *
 * `last_radius` is repaired only when absent, and only from the availability
 * doc's own `radius` -- never invented.
 *
 * USAGE
 *   node backfill_last_label_availability.js            # dry run, writes nothing
 *   node backfill_last_label_availability.js --apply    # perform the writes
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');

// The bug shipped with the auto-detect path; earliest observed match is
// 2026-07-10. Kept deliberately wide so nothing is missed, since the
// signature check below is what actually gates each write.
const CREATED_SINCE = new Date('2026-06-01T00:00:00Z');

const BATCH_LIMIT = 400; // Firestore hard limit is 500.

async function main() {
  console.log(APPLY ? '=== APPLY MODE (writing) ===' : '=== DRY RUN (no writes) ===');

  // Index every availabilities doc by user_id. One full read is cheaper and
  // far faster than a per-user query across thousands of users.
  console.log('Loading availabilities...');
  const availByUser = new Map();
  const availSnap = await db.collection('availabilities').get();
  availSnap.forEach((doc) => {
    const userId = doc.get('user_id');
    if (!userId) return;
    if (!availByUser.has(userId)) availByUser.set(userId, []);
    availByUser.get(userId).push({
      id: doc.id,
      label: doc.get('label') || null,
      city: doc.get('city') || null,
      radius: doc.get('radius') ?? null,
      createdAt: doc.get('created_at') ? doc.get('created_at').toDate() : null,
    });
  });
  console.log(`  ${availSnap.size} availabilities across ${availByUser.size} users`);

  console.log('Loading users...');
  const usersSnap = await db
    .collection('users')
    .where('created_time', '>=', admin.firestore.Timestamp.fromDate(CREATED_SINCE))
    .get();
  console.log(`  ${usersSnap.size} users created since ${CREATED_SINCE.toISOString()}`);

  const targets = [];
  const skipped = {
    pro: 0,
    alreadyOk: 0,
    noAvailDoc: 0,
    labelNotHome: 0,
    lastAvailAlreadySet: 0,
    addressMismatch: 0,
  };

  usersSnap.forEach((doc) => {
    const type = doc.get('type');
    if (type === 'pro' || type === 'super_pro') {
      skipped.pro++;
      return;
    }

    const lastLabel = doc.get('last_label');
    const lastAvailability = doc.get('last_availability');

    if (lastLabel && lastAvailability) {
      skipped.alreadyOk++;
      return;
    }

    const avails = availByUser.get(doc.id) || [];
    if (avails.length === 0) {
      skipped.noAvailDoc++;
      return;
    }

    // Newest first. e_area creates its doc at onboarding, and any later doc
    // the user made themselves should win as "current".
    avails.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    const newest = avails[0];

    // Signature check 1: only the e_area-authored shape carries label 'home'.
    if (newest.label !== 'home') {
      skipped.labelNotHome++;
      return;
    }

    // Signature check 2: never repoint an existing pointer, even a stale one.
    if (lastAvailability) {
      skipped.lastAvailAlreadySet++;
      return;
    }

    // Signature check 3: the user doc and this availability must have been
    // written by the same batch. If the cities disagree, the reconstruction
    // is not safe and we leave the user alone.
    const lastAddress = doc.get('last_address');
    if (!lastAddress || lastAddress !== newest.city) {
      skipped.addressMismatch++;
      return;
    }

    const update = {
      last_label: 'home',
      last_availability: newest.id,
    };
    // Only fill radius when the user has none; never overwrite a real choice.
    if (doc.get('last_radius') == null && newest.radius != null) {
      update.last_radius = newest.radius;
    }

    targets.push({
      uid: doc.id,
      city: newest.city,
      createdTime: doc.get('created_time')?.toDate().toISOString() || null,
      update,
    });
  });

  console.log('\nSkipped (by reason):');
  Object.entries(skipped).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(`\nUsers to backfill: ${targets.length}`);

  const byMonth = {};
  targets.forEach((t) => {
    const m = t.createdTime ? t.createdTime.slice(0, 7) : 'unknown';
    byMonth[m] = (byMonth[m] || 0) + 1;
  });
  console.log('By signup month:', JSON.stringify(byMonth));

  const radiusFixes = targets.filter((t) => t.update.last_radius != null).length;
  console.log(`Of those, also restoring last_radius: ${radiusFixes}`);

  console.log('\nSample (first 10):');
  targets.slice(0, 10).forEach((t) => {
    console.log(
      `  ${t.uid}  ${t.city}  -> last_label=home last_availability=${t.update.last_availability}` +
        (t.update.last_radius != null ? ` last_radius=${t.update.last_radius}` : '')
    );
  });

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write.');
    return;
  }

  console.log('\nWriting...');
  let written = 0;
  for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
    const chunk = targets.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((t) => batch.update(db.collection('users').doc(t.uid), t.update));
    await batch.commit();
    written += chunk.length;
    console.log(`  committed ${written}/${targets.length}`);
  }
  console.log(`\nDone. ${written} users backfilled.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
