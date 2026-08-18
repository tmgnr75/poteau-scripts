// connect_docs_last_14_days.js

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const moment = require('moment'); // Make sure to install moment.js by running `npm install moment`

(async () => {
  try {
    const connectRef = db.collection('connect');
    const now = moment().startOf('day');
    const startDate = now.clone().subtract(14, 'days');

    let dailyCounts = {};

    // Initialize dailyCounts for the past 14 days
    for (let i = 1; i <= 14; i++) {
      const day = startDate.clone().add(i, 'days').format('YYYY-MM-DD');
      dailyCounts[day] = 0;
    }

    const snapshot = await connectRef
      .where('datetime', '>=', startDate.toDate())
      .where('datetime', '<', now.toDate())
      .get();

    snapshot.forEach(doc => {
      const docDate = moment(doc.data().datetime.toDate()).format('YYYY-MM-DD');
      if (dailyCounts[docDate] !== undefined) {
        dailyCounts[docDate]++;
      }
    });

    // Display results
    console.log('Day | Number of Connect Documents');
    console.log('-------------------------------');
    Object.entries(dailyCounts).forEach(([day, count]) => {
      console.log(`${day} | ${count}`);
    });

  } catch (error) {
    console.error('Error retrieving connect documents:', error);
  } finally {
    process.exit();
  }
})();