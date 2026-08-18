const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countUniqueNewUsers() {
  try {
    const startDate = admin.firestore.Timestamp.fromDate(new Date('2023-10-01T00:00:00Z'));
    const endDate = admin.firestore.Timestamp.fromDate(new Date('2023-11-01T00:00:00Z'));

    const querySnapshot = await db
      .collection('users')
      .where('created_time', '>=', startDate)
      .where('created_time', '<', endDate)
      .get();

    const uniqueUserIds = new Set();

    querySnapshot.forEach((doc) => {
      const userId = doc.id;
      uniqueUserIds.add(userId);
    });

    const count = uniqueUserIds.size;
    console.log(`Total unique users created within the date range: ${count}`);
    return count;
  } catch (error) {
    console.error('Error counting unique users:', error);
    throw error;
  }
}

countUniqueNewUsers();