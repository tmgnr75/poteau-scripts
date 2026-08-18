const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countAttendeesWhoAreNewUsers() {
  try {
    const startDate = new Date('2023-08-01T00:00:00Z');
    const endDate = new Date('2023-09-01T00:00:00Z');

    // Query games and store attendees in a set
    const gameQuerySnapshot = await db
      .collection('games')
      .where('status', '==', 'played')
      .where('date', '>=', startDate)
      .where('date', '<', endDate)
      .get();

    const attendees = new Set();

    gameQuerySnapshot.forEach((doc) => {
      const gameAttendees = doc.data().attendees || [];
      gameAttendees.forEach((attendee) => {
        attendees.add(attendee.id);
      });
    });

    // Query users created within the specified timeframe and store their IDs in a set
    const userQuerySnapshot = await db
      .collection('users')
      .where('created_time', '>=', startDate)
      .where('created_time', '<', endDate)
      .get();

    const newUsers = new Set();

    userQuerySnapshot.forEach((doc) => {
      newUsers.add(doc.id);
    });

    // Find the intersection of the two sets (attendees and newUsers)
    const intersection = [...attendees].filter((userId) => newUsers.has(userId));
    const count = intersection.length;

    console.log(`Number of attendees who are also new users: ${count}`);
    return count;
  } catch (error) {
    console.error('Error counting attendees who are new users:', error);
    throw error;
  }
}

countAttendeesWhoAreNewUsers();