const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async function updateTimeZone() {
  console.log('--- Starting script: Update time_zone field in games documents ---');

  const centreName = 'Soctainer Miami';
  const newTimeZone = 'America/New_York';

  console.log(`Searching for games with centre = "${centreName}"...`);

  try {
    const querySnapshot = await db.collection('games').where('centre', '==', centreName).get();

    if (querySnapshot.empty) {
      console.log(`No documents found where centre = "${centreName}". Script completed.`);
      return;
    }

    console.log(`Found ${querySnapshot.size} documents. Starting updates...`);

    const updatePromises = [];
    querySnapshot.forEach((doc) => {
      const docId = doc.id;
      console.log(`Queuing update for document ID: ${docId}...`);

      const updatePromise = db.collection('games').doc(docId).update({ time_zone: newTimeZone })
        .then(() => {
          console.log(`Successfully updated document ID: ${docId} with time_zone: ${newTimeZone}`);
        })
        .catch((err) => {
          console.error(`Error updating document ID: ${docId}. Error: ${err.message}`);
        });

      updatePromises.push(updatePromise);
    });

    console.log('Waiting for all updates to complete...');
    await Promise.all(updatePromises);

    console.log('--- Script completed successfully. All updates processed. ---');
  } catch (error) {
    console.error('An error occurred while processing the documents:', error.message);
  }
})();