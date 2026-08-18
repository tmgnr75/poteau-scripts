const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const usersCollection = db.collection('users');

async function main() {
  try {
    const querySnapshot = await usersCollection.whereField('hash_pic', admin.firestore.FieldPath.isEqual(null)).get();

    if (querySnapshot.empty) {
      console.log('No matching documents.');
      return;
    }

    querySnapshot.forEach(async (doc) => {
      const userId = doc.id;
      const userData = doc.data();

      if (!userData.hasOwnProperty('hash_pic') || userData['hash_pic'] === null || userData['hash_pic'] === '') {
        const userDocRef = usersCollection.doc(userId);
        await userDocRef.update({ hash_pic: 'KCMtaOof0000ay_3xufQ~q' });
        console.log(`Updated 'hash_pic' for user ${userId}`);
      } else {
        console.log(`User ${userId} already has a "hash_pic" field`);
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
  } finally {
    admin.app().delete();
  }
}

main();