const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
  });
}

const db = admin.firestore();

async function investigate() {
  // Check both drafts in detail
  for (const draftId of ['54hbSF1JyD8uiaO8qcWy', 'xw69OZJqFwvr6fe2d5Os']) {
    const doc = await db.collection('draft_games').doc(draftId).get();
    if (doc.exists) {
      console.log(`\n=== DRAFT ${draftId} ===`);
      console.log(JSON.stringify(doc.data(), (key, value) => {
        if (value && value._seconds !== undefined) return new Date(value._seconds * 1000).toISOString();
        if (value && value._path) return value._path.segments.join('/');
        return value;
      }, 2));
    }
  }

  // Check the pro user more in detail
  console.log('\n=== PRO USER 6LqxDqAWJaUlyC7u83GNSThf9zn2 FULL ===');
  const proDoc = await db.collection('users').doc('6LqxDqAWJaUlyC7u83GNSThf9zn2').get();
  if (proDoc.exists) {
    const d = proDoc.data();
    console.log(JSON.stringify(d, (key, value) => {
      if (value && value._seconds !== undefined) return new Date(value._seconds * 1000).toISOString();
      if (value && value._path) return value._path.segments.join('/');
      return value;
    }, 2));
  }

  // Also check Cloud Functions deployment history
  // Check if publishGame was deployed differently before March 3
  // Look at the function's source code version

  process.exit(0);
}

investigate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
