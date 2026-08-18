const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log('[START] Analyzing timeZone usage in repeaters collection');

  const snapshot = await db.collection('repeaters').get();
  const total = snapshot.size;

  const counts = {};
  let missing = 0;

  for (const doc of snapshot.docs) {
    const tz = doc.data().timeZone;
    if (!tz) {
      missing++;
      continue;
    }
    counts[tz] = (counts[tz] || 0) + 1;
  }

  console.log(`\n[SUMMARY] Total repeaters: ${total}`);
  console.log(`[SUMMARY] Missing timeZone: ${missing}`);
  console.log(`[SUMMARY] Breakdown by timeZone:\n`);

  for (const [zone, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`- ${zone}: ${count}`);
  }

  console.log('\n[DONE]');
})();