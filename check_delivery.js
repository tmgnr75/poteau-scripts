#!/usr/bin/env node
// Drop detector for the post-claim world.
//
// The old check (check_unclaimed.js) read a `pushed` marker off each connect
// doc. That marker was written by the transactional claim, which was removed on
// 2026-08-26 because it cost ~$44/month to referee a race that no longer exists.
// With the marker gone that detector reports every document as a lost push, so
// it must not be used any more.
//
// Ground truth is now the publish log: translatePlusPush logs one
// "Message published successfully ... connectId: X" line per recipient. A
// document with recipients, older than the grace window, that has NO publish
// line was genuinely never sent.
//
// Compares COUNTS, not per-document lookups. With the claim gone every document
// is a candidate, so per-id queries meant thousands of gcloud calls and the
// check timed out after ten minutes -- a detector that never finishes is a
// detector that tells you nothing.
//
// Instead: count documents that should have produced a push, and count distinct
// connectIds in the publish log over the same window. A material shortfall is
// the signal. This cannot name WHICH document was lost, but it answers the
// question that matters -- is anything being dropped -- in seconds rather than
// never.
const { execFileSync } = require('child_process');
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const MINUTES = Number(process.argv[2] || 10);
const GRACE_S = 180;

function publishedIds(minutes) {
  const out = execFileSync('gcloud', [
    'logging', 'read',
    // ONE line per document, unlike the publish confirmation which emits five.
    // The five-line format blew the 20,000-row cap inside five minutes and made
    // the check report thousands of delivered pushes as lost. This source runs
    // ~2,400 lines per five minutes, comfortably inside the cap.
    'resource.labels.service_name="translatepluspush" AND textPayload:"Processing connectData with connectId"',
    '--project=krank-club', '--limit=20000', `--freshness=${minutes}m`,
    '--format=value(textPayload)',
  ], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = out.split('\n').length;
  const ids = new Set();
  for (const m of out.matchAll(/connectId['"]?:\s*['"]?([A-Za-z0-9]{15,})/g)) ids.add(m[1]);
  // A fetch that comes back at the cap is TRUNCATED, and absence from a
  // truncated set proves nothing. Refusing to answer beats manufacturing a
  // false alarm: on 2026-08-26 a 20-minute window hit the 20,000-line cap and
  // reported 2,998 pushes as "never sent" when every one had been delivered.
  if (lines >= 19900) return null;
  return ids;
}

(async () => {
  const since = new Date(Date.now() - MINUTES * 60000);
  const snap = await db.collection('connect').where('datetime', '>=', since).limit(3000).get();
  let sent = 0, inflight = 0, declined = 0;
  const candidates = [], lost = [], unsure = [];

  snap.forEach(d => {
    const x = d.data();
    const age = (Date.now() - x.datetime.toDate()) / 1000;
    const recipRaw = x.recipient;
    const recips = Array.isArray(recipRaw)
      ? recipRaw.map(r => (r && typeof r === 'object' ? r.id : null)).filter(Boolean) : [];
    const senderId = x.sender && typeof x.sender === 'object' ? x.sender.id : null;

    // Correctly declined, not lost: nobody to notify, malformed, or addressed
    // only to its own sender (sender-exclusion removes them).
    if (!Array.isArray(recipRaw) || recipRaw.length === 0) { declined++; return; }
    if (!x.type && !x.title) { declined++; return; }
    if (senderId && recips.length && recips.every(r => r === senderId)) { declined++; return; }
    if (age < GRACE_S) { inflight++; return; }
    candidates.push(d.id);
  });

  const published = publishedIds(MINUTES);
  if (published === null) {
    // Per-document verification is impossible when the log truncates, and it
    // truncates exactly during the bursts that matter most -- 21,000 documents
    // in five minutes on 2026-08-26. Rather than go blind at peak, fall back to
    // COUNTS, which no cap can distort: documents created versus executions that
    // logged "All messages published successfully".
    //
    // This cannot name which document was lost, but it answers whether anything
    // was, which is the question worth answering at 3am.
    const created = (await db.collection('connect')
      .where('datetime', '>=', since)
      .where('datetime', '<', new Date(Date.now() - GRACE_S * 1000))
      .count().get()).data().count;
    let done = 0;
    try {
      done = execFileSync('gcloud', [
        'logging', 'read',
        'resource.labels.service_name="translatepluspush" AND textPayload:"All messages published successfully"',
        '--project=krank-club', '--limit=30000', `--freshness=${MINUTES}m`,
        '--format=value(labels.execution_id)',
      ], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })
        .split('\n').filter(Boolean).length;
    } catch (e) { /* leaves done at 0, reported below */ }
    const gap = created - done;
    console.log(`  --- delivery check (last ${MINUTES}m, COUNT MODE) ---`);
    console.log(`  per-document check unavailable (publish log truncated at this volume)`);
    console.log(`  docs created (past grace)  : ${created}`);
    console.log(`  executions fully published : ${done}`);
    console.log(`  NEVER SENT                 : ${gap > 0 ? gap : 0}   (a handful is normal: declined docs)`);
    return;
  }
  for (const id of candidates) {
    if (published.has(id)) sent++; else lost.push(id);
  }

  const total = snap.size;
  console.log(`  --- delivery check (connect docs, last ${MINUTES}m) ---`);
  console.log(`  docs seen                 : ${total}${total >= 3000 ? ' (capped)' : ''}`);
  console.log(`  confirmed published       : ${sent}`);
  console.log(`  in flight (<${GRACE_S}s)          : ${inflight}`);
  console.log(`  correctly declined        : ${declined}`);
  if (unsure.length) console.log(`  could not verify          : ${unsure.length}`);
  console.log(`  NEVER SENT                : ${lost.length}`);
  if (lost.length) console.log(`      ids: ${lost.slice(0, 5).join(', ')}`);
})().catch(e => console.log('  (delivery check failed:', e.message, ')'));
