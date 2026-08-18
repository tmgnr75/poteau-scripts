const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const gamesCollection = db.collection('games');
const repeatersCollection = db.collection('repeaters');

async function main() {
  try {
    const now = new Date();
    
    // Update "games" documents
    const gamesQuerySnapshot = await gamesCollection
      .where('organizer', '==', 'QI89VPazyLhBVnWH871jk4BUEZI3')
      // .where('type', '==', 'pro')
      .where('date', '>', now)
      .get();

    if (!gamesQuerySnapshot.empty) {
      const gamesBatch = db.batch();

      gamesQuerySnapshot.forEach((doc) => {
        const gameDocRef = gamesCollection.doc(doc.id);
        gamesBatch.update(gameDocRef, { status: 'canceled' });
        console.log(`Updated 'status' for game ${doc.id}`);
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