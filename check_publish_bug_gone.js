// Is the publish bug actually gone? Run before telling anyone it is.
//
// Three things must all be true, and only the third is about real users:
//   1. No organizer refused at publish since the fallback deployed.
//   2. The band-aid has caught REAL organizers (not just our own tests).
//   3. Drafts are carrying price_last_known, so the band-aid can work at all.
//
// Until (2) is non-zero we have a fix that is deployed but unproven, and the
// honest thing to tell users is nothing.
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const { execSync } = require('child_process');

const FALLBACK_LIVE = '2026-09-11T09:10:13Z';
const TRIGGER_LIVE  = new Date('2026-09-11T09:04:17Z');
const TEAM = new Set(['Wy5RXZJefwOZfAKG4MvOS6raU2f2']); // our own test publishes

const readAlerts = (code, sinceIso) => {
  try {
    const out = execSync(
      `gcloud logging read 'resource.type="cloud_run_revision" AND ` +
      `resource.labels.service_name="publishgame" AND jsonPayload.code="${code}"` +
      (sinceIso ? ` AND timestamp>="${sinceIso}"` : '') + `' ` +
      `--project=krank-club --freshness=7d --format=json`,
      { encoding: 'utf8', stdio: ['pipe','pipe','ignore'], maxBuffer: 32*1024*1024 });
    return JSON.parse(out || '[]');
  } catch (e) { return null; }
};

(async () => {
  const refusals = readAlerts('GAME_PUBLISHED_WITHOUT_PRICE', FALLBACK_LIVE);
  const restores = readAlerts('GAME_PRICE_RESTORED', null);
  if (refusals === null || restores === null) {
    console.log('Could not read Cloud Logging (check gcloud account).'); process.exit(1);
  }
  const realRestores = restores.filter(e => !TEAM.has((e.jsonPayload||{}).organizer));

  const snap = await db.collection('draft_games').where('created_on', '>=', TRIGGER_LIVE).get();
  let withPlk = 0;
  snap.forEach(d => { if (d.data().price_last_known !== undefined) withPlk++; });

  const refusalDrafts = new Set(refusals.map(e => (e.jsonPayload||{}).draftGameId)).size;

  console.log(`refusals since fallback : ${refusalDrafts} draft(s), ${refusals.length} attempt(s)`);
  console.log(`restores, real users    : ${realRestores.length}  (plus ${restores.length - realRestores.length} own tests)`);
  console.log(`drafts since trigger    : ${snap.size}, carrying price_last_known: ${withPlk}`);

  const proven = refusalDrafts === 0 && realRestores.length > 0;
  console.log(`\n${proven ? 'PROVEN' : 'NOT YET PROVEN'}: ` + (proven
    ? 'no one blocked, and the band-aid has caught real organizers. Safe to tell users.'
    : refusalDrafts > 0
      ? 'organizers are STILL being blocked. Do not claim it is fixed.'
      : 'nobody has been blocked, but the band-aid has not yet caught a real user. Wait.'));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
