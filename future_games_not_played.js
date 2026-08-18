const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const gamesCollection = db.collection('games');

async function main() {
  try {
    const now = new Date();
    const endDate = new Date('2024-08-22T00:00:00+02:00'); // Paris time

    // Retrieve "games" documents
    const gamesQuerySnapshot = await gamesCollection
      .where('date', '>=', now)
      .where('date', '<=', endDate)
      .where('status', '==', 'played')
      .get();

    if (!gamesQuerySnapshot.empty) {
      const gamesBatch = db.batch();

      gamesQuerySnapshot.forEach((doc) => {
        const gameDocRef = gamesCollection.doc(doc.id);
        gamesBatch.update(gameDocRef, { status: 'published' });
        console.log(`Updated 'status' to 'published' for game ${doc.id}`);
      });

      await gamesBatch.commit();
    }
  } catch (error) {
    console.error('Error updating documents:', error);
  } finally {
    admin.app().delete();
  }
}

main();