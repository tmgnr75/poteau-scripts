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
        const targetDate = new Date('2024-07-01T00:00:00+02:00'); // France time (UTC+2)

        // Update "games" documents
        const gamesQuerySnapshot = await gamesCollection
            .where('organizer', '==', 'CtMIzMx3atVuH1nKNOJj6lNQL4A2')
            .where('type', '==', 'pro')
            .where('date', '>=', targetDate)
            .get();

        if (!gamesQuerySnapshot.empty) {
            const gamesBatch = db.batch();

            gamesQuerySnapshot.forEach((doc) => {
                const gameDocRef = gamesCollection.doc(doc.id);
                gamesBatch.update(gameDocRef, {
                    payment_type: 'in-app',
                    currency: 'EUR'
                });
                console.log(`Updated 'payment_type' and 'currency' for game ${doc.id}`);
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