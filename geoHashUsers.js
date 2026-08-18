const admin = require('firebase-admin');
const { geohashForLocation } = require('geofire-common');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const usersRef = db.collection('users'); // Assuming your users are in the 'users' collection

const BATCH_SIZE = 500; // Adjust based on your preference and resource limits
let lastProcessedDoc = null;
let totalProcessed = 0;
let totalUsers = 0;

async function countTotalUsers() {
    const snapshot = await usersRef.get();
    return snapshot.size;
}

async function updateGeoHashes() {
    try {
        let query = usersRef.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);

        if (lastProcessedDoc) {
            query = query.startAfter(lastProcessedDoc);
        }

        const snapshot = await query.get();

        if (snapshot.empty) {
            console.log('No matching documents.');
            return;
        }

        let batch = db.batch();
        snapshot.forEach(doc => {
            const userData = doc.data();
            if (userData.last_location && userData.last_location.latitude && userData.last_location.longitude) {
                const geoHash = geohashForLocation([userData.last_location.latitude, userData.last_location.longitude]);
                batch.update(doc.ref, { geoHash: geoHash });
            }
        });

        await batch.commit();
        lastProcessedDoc = snapshot.docs[snapshot.docs.length - 1];
        totalProcessed += snapshot.size;

        const progressPercent = ((totalProcessed / totalUsers) * 100).toFixed(2);
        console.log(`Processed ${totalProcessed} users (${progressPercent}% complete). Last processed doc ID: ${lastProcessedDoc.id}`);

        if (snapshot.size >= BATCH_SIZE) {
            // Continue processing next batch
            setImmediate(updateGeoHashes);
        } else {
            console.log('Update complete');
        }
    } catch (error) {
        console.error('Error updating GeoHashes', error);
        // Optional: Implement logic to retry or resume from the lastProcessedDoc
    }
}

(async () => {
    totalUsers = await countTotalUsers();
    console.log(`Total users to process: ${totalUsers}`);
    updateGeoHashes();
})();
