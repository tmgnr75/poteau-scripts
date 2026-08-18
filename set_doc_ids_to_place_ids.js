const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateDocumentIds() {
    try {
        const snapshot = await db.collection('cached_centres').get();

        const batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            const newDocRef = db.collection('cached_centres').doc(data.centre_place_id);

            // Set the new document with the data from the old document
            batch.set(newDocRef, data);

            // Delete the old document
            batch.delete(doc.ref);

            console.log(`Queued update for document ID: ${doc.id} to new ID: ${data.centre_place_id}`);
        });

        // Commit the batch
        await batch.commit();
        console.log('Batch update completed successfully.');
    } catch (error) {
        console.error('Error during batch update:', error);
    }
}

updateDocumentIds().then(() => {
    console.log('Document ID update process finished.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});