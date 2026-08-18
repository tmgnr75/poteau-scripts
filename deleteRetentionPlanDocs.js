const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const { DateTime } = require('luxon'); // For date handling
const timeZone = 'Europe/Paris';

(async () => {
    console.log('Starting the deletion script for "connect" documents where source == "retention_plan" and datetime < 18:55 Europe/Paris...');

    try {
        const collectionName = 'connect';
        const now = DateTime.now().setZone(timeZone);
        const cutoffTime = now.startOf('day').set({ hour: 18, minute: 55 });

        console.log(`Current time: ${now.toISO()} (${timeZone})`);
        console.log(`Cutoff time for deletion: ${cutoffTime.toISO()} (${timeZone})`);

        if (now > cutoffTime) {
            console.log(`Deleting documents with datetime < ${cutoffTime.toISO()} (${timeZone})`);
        } else {
            console.log(`Current time is before the cutoff (${cutoffTime.toISO()}). No deletions needed.`);
            return;
        }

        const querySnapshot = await db
            .collection(collectionName)
            .where('source', '==', 'retention_plan')
            .where('datetime', '<', cutoffTime.toJSDate())
            .get();

        const totalFound = querySnapshot.size;
        console.log(`Total documents found: ${totalFound}`);

        if (querySnapshot.empty) {
            console.log(`No documents found in "${collectionName}" matching the criteria. Exiting script.`);
            return;
        }

        let processedCount = 0;
        let deleteCount = 0;

        for (const doc of querySnapshot.docs) {
            console.log(`Processing document with ID: ${doc.id}...`);
            try {
                await db.collection(collectionName).doc(doc.id).delete();
                console.log(`Successfully deleted document with ID: ${doc.id}.`);
                deleteCount++;
            } catch (error) {
                console.error(`Failed to delete document with ID: ${doc.id}. Error: ${error.message}`);
            }
            processedCount++;
        }

        console.log(`Processing completed. Total documents processed: ${processedCount}`);
        console.log(`Total documents successfully deleted: ${deleteCount}`);
        console.log(`Total documents failed to delete: ${processedCount - deleteCount}`);
    } catch (error) {
        console.error('An error occurred during the script execution:', error);
    } finally {
        console.log('Script execution finished.');
        process.exit();
    }
})();