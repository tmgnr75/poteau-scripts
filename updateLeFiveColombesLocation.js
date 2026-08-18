const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

async function updateLeFiveColombesLocation() {
  try {
    console.log('Fetching games where centre == "LE FIVE Colombes"...');

    const querySnapshot = await db.collection('games')
      .where('centre', '==', 'LE FIVE Colombes')
      .get();

    console.log(`Found ${querySnapshot.size} games.`);

    const newLocation = new admin.firestore.GeoPoint(48.9351426, 2.2562566);
    let updatesCount = 0;
    const batchSize = 500;
    let batch = db.batch();

    querySnapshot.forEach((doc) => {
      console.log(`Updating game ID: ${doc.id}`);
      batch.update(doc.ref, { location: newLocation });
      updatesCount++;

      if (updatesCount % batchSize === 0) {
        batch.commit();
        batch = db.batch();
        console.log(`Committed batch of ${batchSize}`);
      }
    });

    if (updatesCount % batchSize !== 0) {
      await batch.commit();
    }

    console.log(`Successfully updated ${updatesCount} game(s).`);
  } catch (error) {
    console.error('Error updating games:', error);
  }
}

updateLeFiveColombesLocation().then(() => {
  console.log('Script execution completed.');
  process.exit(0);
});
