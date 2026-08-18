const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateFutureGames() {
  try {
    console.log('Fetching future games where organizer is "JfJC0qd2OvO5Lb10A6Ia4SuKmAa2"...');
    const now = new Date();
    
    const querySnapshot = await db.collection('games')
      .where('fff_game', '==', true)
      .where('date', '>', now)
      .get();
    
    console.log(`Found ${querySnapshot.size} future games.`);
    
    let updatesCount = 0;
    const batch = db.batch();
    
    querySnapshot.forEach((doc) => {
      console.log(`Updating game ID: ${doc.id}`);
      batch.update(doc.ref, {
        // description: 'XXX',
        fff_game: false
        // price: 3,
        // price_undiscounted: 9
      });
      updatesCount++;
    });
    
    if (updatesCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updatesCount} game(s).`);
    } else {
      console.log('No future games to update.');
    }
  } catch (error) {
    console.error('Error updating future games:', error);
  }
}

updateFutureGames().then(() => {
  console.log('Script execution completed.');
  process.exit(0);
});
