const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function cleanProMetrics() {
    console.log("Starting pro_metrics cleanup...");

    const proMetricsRef = db.collection('pro_metrics');
    const proMetricsSnapshot = await proMetricsRef.get();

    if (proMetricsSnapshot.empty) {
        console.log("No documents found in pro_metrics collection.");
        return;
    }

    console.log(`Found ${proMetricsSnapshot.size} documents in pro_metrics collection.`);

    for (const proMetricDoc of proMetricsSnapshot.docs) {
        const proMetricData = proMetricDoc.data();
        const userRef = proMetricData.user;

        if (!userRef) {
            console.warn(`Document ${proMetricDoc.id} has no user reference. Skipping...`);
            continue;
        }

        try {
            // Attempt to get the user document
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                console.log(`User document for pro_metrics ${proMetricDoc.id} does not exist. Deleting pro_metrics document...`);
                await proMetricDoc.ref.delete();
                console.log(`Deleted pro_metrics document ${proMetricDoc.id} due to missing user.`);
            } else {
                console.log(`User document for pro_metrics ${proMetricDoc.id} exists. No action taken.`);
            }
        } catch (error) {
            console.error(`Error checking user document for pro_metrics ${proMetricDoc.id}: ${error.message}`);
        }
    }

    console.log("Completed pro_metrics cleanup.");
}

cleanProMetrics()
    .then(() => console.log("Cleanup script finished."))
    .catch((error) => console.error("Error running cleanup script:", error));