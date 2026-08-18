const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const now = new Date();
const startDate = new Date('2023-09-10');

// Fetch games where type is 'pro' and created after September 10, 2023
db.collection('games')
  .where('type', '==', 'pro')
  .where('createdAt', '>=', startDate)
  .get()
  .then((querySnapshot) => {
    const gamesWithNullMessages = [];

    querySnapshot.forEach((doc) => {
      const messages = doc.data().messages;

      // Check if the messages array contains at least one null
      if (messages && messages.some((message) => message === null)) {
        gamesWithNullMessages.push(doc.id);
      }
    });

    console.log('Games with null messages and type "pro" since September 10, 2023:', gamesWithNullMessages);
  })
  .catch((error) => {
    console.error('Error getting games with null messages:', error);
  });