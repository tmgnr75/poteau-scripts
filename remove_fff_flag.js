const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateFffGameStatus() {
    try {
        const now = admin.firestore.Timestamp.now();

        // Query games collection where date > now and fff_game == true
        const gamesSnapshot = await db.collection('games')
            .where('date', '>', now)
            .where('fff_game', '==', true)
            .get();

        if (!gamesSnapshot.empty) {
            const gamesBatch = db.batch();
            let gamesCount = 0;

            gamesSnapshot.forEach(doc => {
                const docRef = doc.ref;
                gamesBatch.update(docRef, { fff_game: false });
                gamesCount++;
            });

            await gamesBatch.commit();
            console.log(`Updated ${gamesCount} games documents by setting fff_game to false.`);
        } else {
            console.log('No matching games documents found.');
        }
    } catch (error) {
        console.error('Error during fff_game status update process:', error);
    }
}

updateFffGameStatus().then(() => {
    console.log('fff_game status update process completed.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});