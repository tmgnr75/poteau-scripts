const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function remove_level_field() {
    try {
        const now = admin.firestore.Timestamp.now();

        // 1. Remove "level" from "games" documents where date > now() and fff_game == true
        const gamesSnapshot = await db.collection('games')
            .where('date', '>', now)
            .where('fff_game', '==', true)
            .get();

        if (!gamesSnapshot.empty) {
            const gamesBatch = db.batch();
            let gamesCount = 0;

            gamesSnapshot.forEach(doc => {
                const data = doc.data();
                const docRef = doc.ref;

                if ('level' in data) {
                    gamesBatch.update(docRef, { level: admin.firestore.FieldValue.delete() });
                    gamesCount++;
                }
            });

            await gamesBatch.commit();
            console.log(`Removed "level" field from ${gamesCount} games documents.`);
        } else {
            console.log('No matching games documents found.');
        }

        // 2. Remove "level" from "repeaters" documents where organizer matches
        const repeatersSnapshot = await db.collection('repeaters')
            .where('organizer', 'in', [
                'GawiMoMDqAN8oh8ZWzlAnZ1Ldj12',
                'ioHEl8ayn0S34tjLwuRpR0nkU103',
                'uSeJPOhAaJVUPyU4ATMg8oaYeRG3'
            ])
            .get();

        if (!repeatersSnapshot.empty) {
            const repeatersBatch = db.batch();
            let repeatersCount = 0;

            repeatersSnapshot.forEach(doc => {
                const data = doc.data();
                const docRef = doc.ref;

                if ('level' in data) {
                    repeatersBatch.update(docRef, { level: admin.firestore.FieldValue.delete() });
                    repeatersCount++;
                }
            });

            await repeatersBatch.commit();
            console.log(`Removed "level" field from ${repeatersCount} repeaters documents.`);
        } else {
            console.log('No matching repeaters documents found.');
        }

    } catch (error) {
        console.error('Error during level removal process:', error);
    }
}

remove_level_field().then(() => {
    console.log('Level field removal process completed for both games and repeaters collections.');
}).catch(error => {
    console.error('An error occurred during the level removal process:', error);
});