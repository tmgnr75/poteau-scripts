const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateFields() {
    try {
        // Define old and new values
        const oldValue = 'Le Street Foot en Salle';
        const newValue = 'Le Street Beauchamp';

        const now = admin.firestore.Timestamp.now(); // For filtering games by date

        // 1. Update "games" docs where centre == oldValue and date > now()
        const gamesSnapshot = await db.collection('games')
            .where('centre', '==', oldValue)
            .where('date', '>', now)
            .get();

        if (gamesSnapshot.empty) {
            console.log('No matching games documents found.');
        } else {
            const gamesBatch = db.batch();
            let gamesCount = 0;

            gamesSnapshot.forEach(doc => {
                const docRef = doc.ref;
                gamesBatch.update(docRef, { centre: newValue });
                gamesCount++;
            });

            await gamesBatch.commit();
            console.log(`Updated ${gamesCount} games documents.`);
        }

        // 2. Update "repeaters" docs where centre == oldValue
        const repeatersSnapshot = await db.collection('repeaters')
            .where('centre', '==', oldValue)
            .get();

        if (repeatersSnapshot.empty) {
            console.log('No matching repeaters documents found.');
        } else {
            const repeatersBatch = db.batch();
            let repeatersCount = 0;

            repeatersSnapshot.forEach(doc => {
                const docRef = doc.ref;
                repeatersBatch.update(docRef, { centre: newValue });
                repeatersCount++;
            });

            await repeatersBatch.commit();
            console.log(`Updated ${repeatersCount} repeaters documents.`);
        }

        // 3. Update "cached_centres" docs where centre_name == oldValue
        const cachedCentresSnapshot = await db.collection('cached_centres')
            .where('centre_name', '==', oldValue)
            .get();

        if (cachedCentresSnapshot.empty) {
            console.log('No matching cached_centres documents found.');
        } else {
            const cachedCentresBatch = db.batch();
            let cachedCentresCount = 0;

            cachedCentresSnapshot.forEach(doc => {
                const docRef = doc.ref;
                cachedCentresBatch.update(docRef, { centre_name: newValue });
                cachedCentresCount++;
            });

            await cachedCentresBatch.commit();
            console.log(`Updated ${cachedCentresCount} cached_centres documents.`);
        }

        // 4. Update "users" docs where display_name == oldValue
        const usersSnapshot = await db.collection('users')
            .where('display_name', '==', oldValue)
            .get();

        if (usersSnapshot.empty) {
            console.log('No matching users documents found.');
        } else {
            const usersBatch = db.batch();
            let usersCount = 0;

            usersSnapshot.forEach(doc => {
                const docRef = doc.ref;
                usersBatch.update(docRef, { display_name: newValue, centre_name: newValue });
                usersCount++;
            });

            await usersBatch.commit();
            console.log(`Updated ${usersCount} users documents.`);
        }

    } catch (error) {
        console.error('Error during batch update:', error);
    }
}

updateFields().then(() => {
    console.log('All collections updated successfully.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});