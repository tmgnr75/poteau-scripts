// Watch publishGame for price problems after the 2026-09-10 fix.
//
// Answers two questions per run:
//   1. Are newly published games carrying a price?
//   2. Is the new guard refusing anything (GAME_PUBLISHED_WITHOUT_PRICE)?
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

  let refusals = 0, refusalLines = [];
  // Refusals: the guard working is a GOOD sign, but each one is an organizer
  // who could not publish, so they are worth seeing.
  try {
    const out = execSync(
      `gcloud logging read 'resource.type="cloud_run_revision" AND ` +
      `resource.labels.service_name="publishgame" AND ` +
      `jsonPayload.code="GAME_PUBLISHED_WITHOUT_PRICE"' ` +
      `--project=krank-club --limit=25 --freshness=${SINCE_MIN}m --format=json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const entries = JSON.parse(out || '[]');
    console.log(`\nguard refusals in window: ${entries.length}`);
    entries.forEach(e => {
      const p = e.jsonPayload || {};
      console.log(`   ${e.timestamp.slice(0, 16)}  draft=${p.draftGameId}  centre=${p.centre}  organizer=${p.organizer}`);
    });
    if (entries.length) {
      console.log('   (each is an organizer blocked at publish - check they retried and succeeded)');
    }
    refusals = entries.length;
    refusalLines = entries.map(e => {
      const p = e.jsonPayload || {};
      return `• \`${p.draftGameId}\` ${p.centre}`;
    });
  } catch (e) {
    console.log('\n(could not read Cloud Logging - check gcloud auth)');
  }

  const ok = bad.length === 0;
  const lines = [
    `${ok ? ':white_check_mark:' : ':rotating_light:'} *publishGame price monitor* (last ${SINCE_MIN} min)`,
    `Games created: *${snap.size}*  |  priced: *${priced}*  |  free (0): *${zero}*  |  no price: *${missing}*` +
      (legacy ? ` (${legacy} pre-guard)` : '') + (inferred ? `  |  inferred: ${inferred}` : ''),
  ];
  if (!ok) {
    lines.push('*Published with NO price - the guard should have stopped these:*');
    bad.forEach(b => lines.push(`• \`${b.id}\` ${b.centre} [${b.status}]`));
  } else {
    lines.push(`No game published without a price since the guard went live${legacy ? ` (${legacy} older ones in window are pre-existing)` : ''}.`);
  }
  if (refusals > 0) {
    lines.push(`Guard refusals: *${refusals}* (organizer blocked at publish, check they retried)`);
    refusalLines.forEach(l => lines.push(l));
  }
  postToSlack(lines.join('\n'));
  process.exit(0);
})();
