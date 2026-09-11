// Watch publishGame for price problems after the 2026-09-10 fix.
//
// Answers three questions per run:
//   1. Are newly published games carrying a price?
//   2. Was anyone stopped at publish (GAME_PUBLISHED_WITHOUT_PRICE)?
//   3. Did anyone's price have to be rescued (GAME_PRICE_RESTORED)?
//
// GREEN MEANS NOBODY STRUGGLED -- not "the guard did its job". Any organizer
// who could not publish, or whose price had to be put back, makes this red.
//
// Read-only. Safe to run repeatedly.
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa    = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const { execSync } = require('child_process');

// --- Slack: #health-reports -------------------------------------------------
// The webhook is bound to that one channel (a webhook cannot be retargeted).
// Posts every run so the quiet runs are evidence too, not just the alarms.
function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) { console.log('\n(SLACK_WEBHOOK_URL not set - not posted)'); return; }
  try {
    execSync(
      `curl -sS -X POST -H 'Content-type: application/json' ` +
      `--data ${JSON.stringify(JSON.stringify({ text }))} ${JSON.stringify(url)}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    console.log('\nposted to #health-reports');
  } catch (e) {
    console.log('\n(Slack post failed)');
  }
}


const SINCE_MIN = Number(process.argv[2] || 120);

// The guard shipped at this moment. Games published BEFORE it cannot be its
// fault, and there are ~175 of them in the collection -- counting those would
// make every run cry wolf forever. Only post-deploy games indict the guard.
const GUARD_LIVE = new Date('2026-09-10T13:12:00Z');

(async () => {
  const since = new Date(Date.now() - SINCE_MIN * 60 * 1000);
  const snap = await db.collection('games').where('created_on', '>=', since).get();

  let priced = 0, zero = 0, missing = 0, inferred = 0, legacy = 0;
  const bad = [];
  snap.forEach(d => {
    const x = d.data();
    if (x.price_inferred) inferred++;
    const has = Object.prototype.hasOwnProperty.call(x, 'price') && x.price !== null;
    if (!has) {
      const created = x.created_on && x.created_on.toDate ? x.created_on.toDate() : null;
      const postGuard = created && created > GUARD_LIVE;
      missing++;
      if (postGuard) bad.push({ id: d.id, centre: x.centre, status: x.status, created });
      else legacy++;
    }
    else if (x.price === 0) zero++;
    else priced++;
  });

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  console.log(`\n=== publishGame price monitor  ${stamp}  (last ${SINCE_MIN} min) ===`);
  console.log(`games created: ${snap.size}   priced: ${priced}   zero: ${zero}   no price: ${missing} (${legacy} pre-guard)   inferred: ${inferred}`);

  if (bad.length > 0) {
    console.log('\n!! games published with NO price (the guard should have stopped these):');
    bad.forEach(b => console.log(`   ${b.id}  ${b.centre}  [${b.status}]`));
  } else {
    console.log(`OK: nothing published without a price since the guard went live${legacy ? ` (${legacy} older ones in window, pre-existing)` : ''}.`);
  }

  // --- Refusals: organizers who could not publish ---------------------------
  //
  // GREEN MEANS NOBODY STRUGGLED. A refusal is not the guard "working well", it
  // is an organizer stopped at the last step of creating a game. On 2026-09-10
  // this section was cosmetic -- the colour was driven only by `bad` (games that
  // slipped through priceless), so a run where 10 organizers were blocked 88
  // times still posted a green tick. That is how the retry storm went unnoticed
  // for a day. Any organizer with a bad publish experience now turns this red.
  //
  // COUNTED BY DRAFT, NOT BY LOG LINE. The refusal log fires once per attempt,
  // and a blocked organizer retries -- one person pressed Publish 12 times on
  // the same draft. Reporting 88 "refusals" invented volume that did not exist
  // and buried the real number, which is 19 drafts across 10 people. Attempts
  // are still shown, because a high retry count IS the bad-UX signal.
  //
  // NO --limit. The old 25 cap silently truncated: three consecutive posts read
  // exactly "25" because that was the ceiling, not the count.
  let refusalDrafts = [], refusalAttempts = 0, refusalOrganizers = 0;
  let restoredCount = 0, restoredLines = [];
  let logReadFailed = false;
  try {
    const readAlerts = (code) => {
      const out = execSync(
        `gcloud logging read 'resource.type="cloud_run_revision" AND ` +
        `resource.labels.service_name="publishgame" AND ` +
        `jsonPayload.code="${code}"' ` +
        `--project=krank-club --freshness=${SINCE_MIN}m --format=json`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], maxBuffer: 32 * 1024 * 1024 }
      );
      return JSON.parse(out || '[]');
    };

    const entries = readAlerts('GAME_PUBLISHED_WITHOUT_PRICE');
    refusalAttempts = entries.length;

    // Collapse to one row per draft, keeping how many times it was attempted.
    const byDraft = new Map();
    entries.forEach(e => {
      const p = e.jsonPayload || {};
      const key = p.draftGameId || '(unknown)';
      if (!byDraft.has(key)) {
        byDraft.set(key, { id: key, centre: p.centre, organizer: p.organizer, attempts: 0 });
      }
      byDraft.get(key).attempts++;
    });
    refusalDrafts = [...byDraft.values()].sort((a, b) => b.attempts - a.attempts);
    refusalOrganizers = new Set(refusalDrafts.map(d => d.organizer)).size;

    console.log(`\nguard refusals in window: ${refusalDrafts.length} draft(s), ${refusalAttempts} attempt(s), ${refusalOrganizers} organizer(s)`);
    refusalDrafts.forEach(d => {
      console.log(`   draft=${d.id}  centre=${d.centre}  organizer=${d.organizer}  attempts=${d.attempts}`);
    });

    // A restored price means the organizer HIT the bug and the band-aid caught
    // it. The game got published, so it is not a refusal -- but it is still a
    // broken experience, and it still turns the report red.
    const restored = readAlerts('GAME_PRICE_RESTORED');
    restoredCount = restored.length;
    const byRestored = new Map();
    restored.forEach(e => {
      const p = e.jsonPayload || {};
      const key = p.draftGameId || '(unknown)';
      if (!byRestored.has(key)) byRestored.set(key, { id: key, centre: p.centre, price: p.price });
    });
    restoredLines = [...byRestored.values()].map(r => `• \`${r.id}\` ${r.centre} (price ${r.price} put back)`);
    if (restoredCount) console.log(`\nprices restored from price_last_known: ${restoredCount}`);
  } catch (e) {
    // Must never look like a clean run. A failed log read used to leave
    // refusals at 0, which rendered identically to "nobody was blocked".
    logReadFailed = true;
    console.log('\n(could not read Cloud Logging - check gcloud auth)');
  }

  // Green ONLY when nothing went wrong for anyone: no priceless game slipped
  // through, nobody was refused, nobody needed a rescued price, and we were
  // actually able to look.
  const ok = bad.length === 0 && refusalDrafts.length === 0 && restoredCount === 0 && !logReadFailed;

  const lines = [
    `${ok ? ':white_check_mark:' : ':rotating_light:'} *publishGame price monitor* (last ${SINCE_MIN} min)`,
    `Games created: *${snap.size}*  |  priced: *${priced}*  |  free (0): *${zero}*  |  no price: *${missing}*` +
      (legacy ? ` (${legacy} pre-guard)` : '') + (inferred ? `  |  inferred: ${inferred}` : ''),
  ];

  if (logReadFailed) {
    lines.push('*Could not read Cloud Logging* - refusals unknown for this window (check gcloud auth).');
  }

  if (bad.length > 0) {
    lines.push('*Published with NO price - the guard should have stopped these:*');
    bad.forEach(b => lines.push(`• \`${b.id}\` ${b.centre} [${b.status}]`));
  }

  if (refusalDrafts.length > 0) {
    const people = refusalOrganizers === 1 ? '1 organizer' : `${refusalOrganizers} organizers`;
    lines.push(
      `*${people} could not publish* - ${refusalDrafts.length} game${refusalDrafts.length === 1 ? '' : 's'} blocked, ` +
      `${refusalAttempts} attempt${refusalAttempts === 1 ? '' : 's'}:`
    );
    refusalDrafts.forEach(d => lines.push(
      `• \`${d.id}\` ${d.centre}${d.attempts > 1 ? ` - tried ${d.attempts}x` : ''}`
    ));
  }

  if (restoredCount > 0) {
    lines.push(`*${restoredCount} price${restoredCount === 1 ? '' : 's'} lost and put back* (organizer hit the back-chevron bug):`);
    restoredLines.forEach(l => lines.push(l));
  }

  if (ok) {
    lines.push(`Everyone who tried to publish succeeded, with a price${legacy ? ` (${legacy} older price-less games in window are pre-existing)` : ''}.`);
  }

  postToSlack(lines.join('\n'));
  process.exit(0);
})();
