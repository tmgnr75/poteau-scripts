const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const FRIEND_DOC_PATH = '/users/pE7XPM7CSRf2vbXx5JLVHkYudSJ3';

(async () => {
  try {
    console.log('🔥 Starting query to find users with a specific friend reference...');
    console.log(`📎 Target friend document reference: ${FRIEND_DOC_PATH}`);

    const friendRef = db.doc(FRIEND_DOC_PATH);

    console.log('📡 Querying the users collection...');
    const snapshot = await db.collection('users')
      .where('friends', 'array-contains', friendRef)
      .get();

    if (snapshot.empty) {
      console.log('🚫 No users found with the specified friend reference.');
      return;
    }

    console.log(`✅ Found ${snapshot.size} user(s) with the specified friend reference:\n`);
    snapshot.forEach(doc => {
      console.log(`🔹 User ID: ${doc.id}`);
    });

    console.log('\n🎉 Query completed successfully.');

  } catch (error) {
    console.error('❌ Error occurred while querying users:', error);
  }
})();