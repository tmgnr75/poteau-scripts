#!/usr/bin/env node
// Count connect docs created in the last N minutes. Used by push_health.sh as
// the denominator for retry amplification: every redelivery is a billed
// invocation, so requests-per-document is the tell for a retry loop inflating
// the bill without matching user traffic.
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const m = Number(process.argv[2] || 10);
(async () => {
  const s = new Date(Date.now() - m * 60000);
  const c = await admin.firestore().collection('connect').where('datetime', '>=', s).count().get();
  console.log(c.data().count);
})().catch(() => { console.log('ERR'); });
