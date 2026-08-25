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
  let stale = 0, inflight = 0, noRecip = 0, malformed = 0, selfOnly = 0;
  snap.forEach(d => {
    const age = (Date.now() - d.get('datetime').toDate()) / 1000;
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
    if ((d.get('recipient') || []).length === 0) { noRecip++; return; }
    if (!d.get('type') && !d.get('title')) { malformed++; return; }
    // Sender-exclusion: the handler drops the sender from the recipient list, so
    // a doc addressed only to its own sender resolves to nobody. Verified live
    // on 2026-08-25: a live_kickoff where sender and sole recipient were the
    // same UID, logged "No recipients to process" by BOTH generations. Counting
    // it as a dropped push reported a 2.13% failure rate against a system that
    // was behaving exactly as designed.
    const senderId = d.get('sender') && d.get('sender').id;
    const recips = (d.get('recipient') || []).map(r => r && r.id).filter(Boolean);
    if (senderId && recips.length && recips.every(r => r === senderId)) { selfOnly++; return; }
    if (age < GRACE_S) inflight++; else stale++;
  });
  const total = snap.size;
  const pct = total ? (100 * stale / total).toFixed(2) : '0.00';
  console.log(`  --- end-to-end (connect docs, last ${MINUTES}m) ---`);
  console.log(`  docs seen                 : ${total}${total >= 3000 ? ' (capped)' : ''}`);
  console.log(`  claimed                   : ${JSON.stringify(by)}`);
  console.log(`  in flight (<${GRACE_S}s)          : ${inflight}`);
  console.log(`  no recipients (fine)      : ${noRecip}`);
  console.log(`  malformed, no type (fine) : ${malformed}`);
  console.log(`  sender-only (fine)        : ${selfOnly}`);
  console.log(`  DROPPED (>${GRACE_S}s, unclaimed) : ${stale}  (${pct}%)`);
  if (stale > 0) {
    console.log(`  *** ${stale} push(es) NEVER SENT - this is the 09:30 failure signature ***`);
    process.exitCode = 0; // reporting tool: never fail the monitor
  }
})().catch(e => { console.log('  (unclaimed check failed:', e.message, ')'); });
