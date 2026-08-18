const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countDocumentsByDeclaredLevel() {
  try {
    // Loop over declared_level values
    for (let level = 0; level <= 5; level++) {
      const querySnapshot = await db
        .collection('users')
        .where('declared_level', '==', level)
        .get();

      console.log(`Total users with declared_level ${level}: ${querySnapshot.size}`);
    }
  } catch (error) {
    console.error('Error counting documents by declared level:', error);
    throw error;
  }
}

countDocumentsByDeclaredLevel();
