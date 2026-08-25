#!/usr/bin/env node
// End-to-end drop detector for the Gen1 -> Gen2 push cutover.
//
// This is the check that actually caught the first failed flip. Log counts
// cannot: a connect doc whose trigger never fired leaves NO log line anywhere,
// so "published 233, delivered 36" looked perfectly healthy while 51 docs were
// being dropped on the floor. The only durable evidence is the `pushed` marker
// on the doc itself -- absent means nobody ever sent it.
//
// A doc younger than 60s may simply be in flight, so only older ones count.
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const { execFileSync } = require('child_process');

// Was this specific connect doc actually published?
//
// The `pushed` marker lives on the doc and can be OVERWRITTEN after the push
// has gone out -- the app's invite_poteau_friends.dart does exactly that, a
// batch.set() with no merge that wipes pushed/pushed_by/title/message. On
// 2026-08-25 that made a delivered invitation look like a lost push.
//
// A publish log line cannot be overwritten by the app, so it is the honest
// second opinion. This queries ONE id at a time, deliberately: a bulk fetch of
// every publish line was tried first and gcloud returned wildly different
// counts for identical queries at this volume (1,196 / 0 / 20,000 across three
// runs), which is worse than no check -- a truncated result is indistinguishable
// from "never published". Per-id lookups are small, exact, and only run for the
// handful of docs that look unclaimed, so the cost is trivial.
function wasPublished(id) {
  try {
    const out = execFileSync('gcloud', [
      'logging', 'read',
      `resource.labels.service_name="translatepluspush" AND textPayload:"${id}"`,
      '--project=krank-club', '--limit=5', '--freshness=60m',
      '--format=value(textPayload)',
    ], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
    return out.includes('Message published successfully');
  } catch (e) {
    return null; // could not tell
  }
}

const MINUTES = Number(process.argv[2] || 15);
// 180s, not 60. At 60 this reported a "drop" that was simply still in flight and
// claimed moments later -- a false positive on the very first post-flip check.
// Gen1's p99 is 5.8s, but with retry enabled a redelivery can arrive well after
// that, and a burst queues behind the instance ceiling. Three minutes is longer
// than any observed legitimate delay and still catches a real drop within one
// monitor tick.
const GRACE_S = 180;

(async () => {
  const since = new Date(Date.now() - MINUTES * 60000);
  const snap = await db.collection('connect').where('datetime', '>=', since).limit(3000).get();
  const by = {};
  let stale = 0, inflight = 0, noRecip = 0, malformed = 0, selfOnly = 0, overwritten = 0;
  const candidates = [], lost = [], unsure = [];
  snap.forEach(d => {
    const age = (Date.now() - d.get('datetime').toDate()) / 1000;
    // `recipient` is normally an array of DocumentReferences but is not
    // guaranteed to be either -- some docs carry a bare value. Guard both, or a
    // single odd document crashes the whole check and the monitor silently
    // reports nothing, which is worse than a false positive.
    const senderRaw = d.get('sender');
    const senderId = senderRaw && typeof senderRaw === 'object' ? senderRaw.id : null;
    const recipRaw = d.get('recipient');
    const recips = Array.isArray(recipRaw)
      ? recipRaw.map(r => (r && typeof r === 'object' ? r.id : null)).filter(Boolean)
      : [];
    if (d.get('pushed') === true) { const g = d.get('pushed_by') || '?'; by[g] = (by[g] || 0) + 1; return; }
    // Docs the handler legitimately declines, which are NOT drops. Both
    // generations agree on these -- verified against live examples on
    // 2026-08-25, where each was logged identically by Gen1 and Gen2:
    //   - no recipients at all
    //   - a doc with no `type` and no `title`, which the handler rejects with
    //     "Title not found" and has always rejected; malformed, not missed
    // The recipient array is also filtered later (sender exclusion, dedup), so
    // a doc can arrive with recipients and still correctly resolve to nobody.
    // Counting those as dropped pushes reported phantom failures at ~5%.
    if (!Array.isArray(recipRaw) || recipRaw.length === 0) { noRecip++; return; }
    if (!d.get('type') && !d.get('title')) { malformed++; return; }
    // Sender-exclusion: the handler drops the sender from the recipient list, so
    // a doc addressed only to its own sender resolves to nobody. Verified live
    // on 2026-08-25: a live_kickoff where sender and sole recipient were the
    // same UID, logged "No recipients to process" by BOTH generations. Counting
    // it as a dropped push reported a 2.13% failure rate against a system that
    // was behaving exactly as designed.
    if (senderId && recips.length && recips.every(r => r === senderId)) { selfOnly++; return; }
    if (age < GRACE_S) { inflight++; return; }
    // No marker. Before calling it lost, check whether it was actually published
    // and the marker was simply overwritten afterwards.
    candidates.push(d.id);
  });
  // Only the suspicious handful reach the log check.
  for (const id of candidates) {
    const p = wasPublished(id);
    if (p === true) { overwritten++; continue; }
    if (p === null) { unsure.push(id); continue; }
    stale++; if (lost.length < 5) lost.push(id);
  }

  const total = snap.size;
  const pct = total ? (100 * stale / total).toFixed(2) : '0.00';
  console.log(`  --- end-to-end (connect docs, last ${MINUTES}m) ---`);
  console.log(`  docs seen                 : ${total}${total >= 3000 ? ' (capped)' : ''}`);
  console.log(`  claimed                   : ${JSON.stringify(by)}`);
  console.log(`  in flight (<${GRACE_S}s)          : ${inflight}`);
  console.log(`  no recipients (fine)      : ${noRecip}`);
  console.log(`  malformed, no type (fine) : ${malformed}`);
  console.log(`  sender-only (fine)        : ${selfOnly}`);
  console.log(`  sent, marker overwritten  : ${overwritten}`);
  if (unsure.length) console.log(`  could not verify          : ${unsure.length}`);
  console.log(`  DROPPED (>${GRACE_S}s, unclaimed) : ${stale}  (${pct}%)`);
  if (stale > 0) {
    console.log(`  *** ${stale} push(es) NEVER SENT - no marker AND no publish log ***`);
    console.log(`      ids: ${lost.join(', ')}`);
    process.exitCode = 0; // reporting tool: never fail the monitor
  }
})().catch(e => { console.log('  (unclaimed check failed:', e.message, ')'); });
