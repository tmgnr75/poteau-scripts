const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function run() {
  const LIMIT = 10000;
  console.log(`🔍 Fetching last ${LIMIT} 'connect' documents ordered by datetime desc...`);

  let snapshot;
  try {
    snapshot = await db.collection('connect')
      .orderBy('datetime', 'desc')
      .limit(LIMIT)
      .get();
  } catch (err) {
    console.error('❌ Error during Firestore query:', err);
    return;
  }

  console.log(`📦 Retrieved ${snapshot.size} documents`);

  const counts = {};

  snapshot.docs.forEach(doc => {
    const source = doc.get('source') || 'undefined';
    counts[source] = (counts[source] || 0) + 1;
  });

  console.log('\n📊 Document count by source:');
  Object.entries(counts).forEach(([source, count]) => {
    console.log(`- ${source}: ${count}`);
  });
}

run().catch((error) => {
  console.error('❌ Error running script:', error);
});