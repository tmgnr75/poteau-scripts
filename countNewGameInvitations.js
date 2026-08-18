const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countNewGameInvitations() {
  try {
    console.log('Starting countNewGameInvitations script...');

    // Get the timestamp for 24 hours ago
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Filtering documents created between: ${twentyFourHoursAgo.toISOString()} and ${now.toISOString()}`);

    // Query Firestore for game_invitations created in the last 24 hours
    const querySnapshot = await db.collection('game_invitations')
      .where('created', '>=', admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
      .where('created', '<', admin.firestore.Timestamp.fromDate(now))
      .where('status', '==', 'declined')
      .get();

    // Count the documents
    const count = querySnapshot.size;
    console.log(`Number of new game_invitations accepted in the last 24 hours: ${count}`);

    return { count };
  } catch (error) {
    console.error('Error fetching game_invitations:', error);
  }
}

countNewGameInvitations();
