const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
console.log('Initializing Firebase Admin SDK...');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Define the collection and query parameters
const COLLECTION_NAME = 'game_invitations';
// Reference to the users collection
const usersCollectionRef = db.collection('users');

// Reference to the specific user document
const inviteeRef = usersCollectionRef.doc('Wy5RXZJefwOZfAKG4MvOS6raU2f2');

// Calculate the date 6 days ago from now
const now = new Date();
const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

console.log(`Fetching documents from collection: ${COLLECTION_NAME}`);
console.log(`Filtering documents where created > ${sixDaysAgo.toISOString()} and invitee = ${inviteeRef}`);

async function fetchGameInvitations() {
  try {
    console.log('Building query...');
    const querySnapshot = await db.collection(COLLECTION_NAME)
      .where('created', '>', sixDaysAgo)
      .where('invitee', '==', inviteeRef)
      .get();

    console.log(`Query executed. Number of documents found: ${querySnapshot.size}`);

    if (querySnapshot.empty) {
      console.log('No upcoming game invitations found for the specified invitee.');
    } else {
      console.log('Listing document IDs and associated game centres:');
      for (const doc of querySnapshot.docs) {
        const gameRef = doc.data().game;
        const gameDoc = await gameRef.get();
        const centre = gameDoc.exists ? gameDoc.data().centre : 'Unknown game';
        console.log(`- Document ID: ${doc.id}, Centre: ${centre}`);
      }
    }
  } catch (error) {
    console.error('Error fetching game invitations:', error);
  }
}

fetchGameInvitations();
