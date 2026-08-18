const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function setPriorityForCachedCentres() {
  console.log('Starting the script to set priority for all documents in the "cached_centres" collection.');

  const collectionName = 'cached_centres';
  const priorityValue = 0; // Default value for the priority field
  let processedCount = 0;
  let errorCount = 0;

  try {
    console.log(`Fetching all documents from the "${collectionName}" collection...`);
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`No documents found in the "${collectionName}" collection. Exiting script.`);
      return;
    }

    console.log(`Found ${snapshot.size} documents in the "${collectionName}" collection.`);
    console.log('Starting to update each document with the "priority" field...');

    const updatePromises = snapshot.docs.map(async (doc) => {
      const docId = doc.id;
      const docData = doc.data();

      console.log(`Processing document with ID: ${docId}`);
      console.log(`Current data: ${JSON.stringify(docData)}`);

      try {
        await db.collection(collectionName).doc(docId).update({ priority: priorityValue });
        console.log(`Successfully updated document with ID: ${docId}. Set "priority" to ${priorityValue}.`);
        processedCount++;
      } catch (error) {
        console.error(`Error updating document with ID: ${docId}. Error: ${error.message}`);
        errorCount++;
      }
    });

    await Promise.all(updatePromises);

    console.log(`Script completed. Total documents processed: ${processedCount}. Total errors: ${errorCount}.`);
  } catch (error) {
    console.error(`An error occurred while processing the "${collectionName}" collection: ${error.message}`);
  }
}

setPriorityForCachedCentres().then(() => {
  console.log('Script execution finished.');
  process.exit(0);
}).catch((error) => {
  console.error(`Unhandled error in the script: ${error.message}`);
  process.exit(1);
});