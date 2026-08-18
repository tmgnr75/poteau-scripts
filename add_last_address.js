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
    // Query users where last_address is not null
    const notNullQuerySnapshot = await usersCollection.where('last_address', '!=', null).get();

    // Create a set to store user IDs with non-null last_address
    const notNullLastAddressUsers = new Set();

    notNullQuerySnapshot.forEach((doc) => {
      notNullLastAddressUsers.add(doc.id);
    });

    // Query all users
    const allUsersQuerySnapshot = await usersCollection.get();

    if (allUsersQuerySnapshot.empty) {
      console.log('No users found.');
      return;
    }

    allUsersQuerySnapshot.forEach(async (doc) => {
      const userId = doc.id;

      if (!notNullLastAddressUsers.has(userId)) {
        // Handle only users not in the first query
        const userData = doc.data();

        if (!userData.hasOwnProperty('last_address') || userData['last_address'] === null || userData['last_address'] === '') {
          const userDocRef = usersCollection.doc(userId);
          await userDocRef.update({ last_address: '(Choisir une ville)' });
          console.log(`Updated 'last_address' for user ${userId}`);
        } else {
          console.log(`User ${userId} already has a "last_address" field`);
        }
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
  } finally {
    admin.app().delete();
  }
}

main();