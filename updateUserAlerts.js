const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateUserAlerts() {
    const alertsRef = db.collection('alerts');
    const alertsSnapshot = await alertsRef.get();
    const totalAlerts = alertsSnapshot.size;

    console.log(`Total alerts found: ${totalAlerts}`);

    const batchLimit = 500; // Firebase batch limit
    let processedCount = 0;
    let batchCount = 0;

    try {
        // Initialize a batch operation
        let batch = db.batch();

        for (const alertDoc of alertsSnapshot.docs) {
            processedCount++;
            const alertData = alertDoc.data();
            const alertId = alertDoc.id;
            const userRef = alertData.user;

            console.log(`[${processedCount}/${totalAlerts}] Processing alert: ${alertId}, for user: ${userRef.id}`);

            const userDoc = await userRef.get();
            if (!userDoc.exists) {
                console.error(`User document ${userRef.id} does not exist. Skipping.`);
                continue;
            }

            const userAlerts = userDoc.data().alerts || [];
            const alertDocRef = db.collection('alerts').doc(alertId);

            // Check if the alert is already in the user's alerts array
            const alertExists = userAlerts.some(alert => alert.isEqual(alertDocRef));
            if (!alertExists) {
                console.log(`Alert ${alertId} does not exist in user ${userRef.id}'s alerts array. Adding.`);
                const updatedAlerts = [...userAlerts, alertDocRef];

                // Add update operation to batch
                batch.update(userRef, { alerts: updatedAlerts });

                // Track batch progress
                if (processedCount % batchLimit === 0) {
                    console.log(`Committing batch #${++batchCount} with ${batchLimit} updates.`);
                    await batch.commit();
                    console.log(`Batch #${batchCount} committed successfully.`);

                    // Reset batch after commit
                    batch = db.batch();
                }
            } else {
                console.log(`Alert ${alertId} already exists in user ${userRef.id}'s alerts array. Skipping.`);
            }

            // Log progress at every 100 documents
            if (processedCount % 100 === 0) {
                console.log(`Processed ${processedCount} out of ${totalAlerts} alerts.`);
            }
        }

        // Commit remaining operations in the batch if any
        if (processedCount % batchLimit !== 0) {
            console.log(`Committing remaining batch with ${processedCount % batchLimit} updates.`);
            await batch.commit();
            console.log('Remaining batch committed successfully.');
        }

        console.log(`All alerts processed. Total processed: ${processedCount}/${totalAlerts}`);
    } catch (error) {
        console.error('Error processing alerts: ', error);
    }
}

updateUserAlerts();