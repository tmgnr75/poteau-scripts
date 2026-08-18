const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateTimeZoneInRepeaters() {
    try {
        // Define the old and new time zone values
        const oldTimeZone = 'heure d’été d’Europe centrale';
        const newTimeZone = 'Europe/Paris';

        // Fetch "repeaters" docs where timeZone == oldTimeZone
        const repeatersSnapshot = await db.collection('repeaters')
            .where('timeZone', '==', oldTimeZone)
            .get();

        if (repeatersSnapshot.empty) {
            console.log('No matching repeaters documents found.');
            return;
        }

        const batch = db.batch();
        let repeatersCount = 0;

        repeatersSnapshot.forEach(doc => {
            const docRef = doc.ref;
            batch.update(docRef, { timeZone: newTimeZone });
            repeatersCount++;
        });

        // Commit the batch update
        await batch.commit();
        console.log(`Updated ${repeatersCount} repeaters documents to timeZone: ${newTimeZone}`);
    } catch (error) {
        console.error('Error during batch update:', error);
    }
}

updateTimeZoneInRepeaters().then(() => {
    console.log('Time zone update process finished.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});