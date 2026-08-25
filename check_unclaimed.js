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
const GRACE_S = 60;

(async () => {
  const since = new Date(Date.now() - MINUTES * 60000);
  const snap = await db.collection('connect').where('datetime', '>=', since).limit(3000).get();
  const by = {};
  let stale = 0, inflight = 0, noRecip = 0;
  snap.forEach(d => {
    const age = (Date.now() - d.get('datetime').toDate()) / 1000;
    if (d.get('pushed') === true) { const g = d.get('pushed_by') || '?'; by[g] = (by[g] || 0) + 1; return; }
    if ((d.get('recipient') || []).length === 0) { noRecip++; return; }
    if (age < GRACE_S) inflight++; else stale++;
  });
  const total = snap.size;
  const pct = total ? (100 * stale / total).toFixed(2) : '0.00';
  console.log(`  --- end-to-end (connect docs, last ${MINUTES}m) ---`);
  console.log(`  docs seen                 : ${total}${total >= 3000 ? ' (capped)' : ''}`);
  console.log(`  claimed                   : ${JSON.stringify(by)}`);
  console.log(`  in flight (<${GRACE_S}s)          : ${inflight}`);
  console.log(`  no recipients (fine)      : ${noRecip}`);
  console.log(`  DROPPED (>${GRACE_S}s, unclaimed) : ${stale}  (${pct}%)`);
  if (stale > 0) {
    console.log(`  *** ${stale} push(es) NEVER SENT - this is the 09:30 failure signature ***`);
    process.exitCode = 0; // reporting tool: never fail the monitor
  }
})().catch(e => { console.log('  (unclaimed check failed:', e.message, ')'); });
