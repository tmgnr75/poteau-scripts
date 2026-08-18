const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function inputTimeZoneForRepeaters() {
    try {
        const collectionRef = db.collection('repeaters');

        // Update documents where "type" is "pro"
        const querySnapshot = await collectionRef.get();

        const batch = db.batch();

        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, {
                timeZone: 'Europe/Paris',
            });
        });

        // Commit the batch update
        await batch.commit();

        console.log('Documents updated successfully');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

inputTimeZoneForRepeaters();
