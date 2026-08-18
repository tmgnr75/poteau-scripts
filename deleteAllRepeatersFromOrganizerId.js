// deleteAllRepeatersFromOrganizerId

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async function deleteRepeaters() {
  const COLLECTION_NAME = 'repeaters'; // Name of the collection
  const ORGANIZER_ID = 'zCvsukfMuuffsuPpSTQwb7MusMD2';

  console.log(`Starting script to delete all documents in the '${COLLECTION_NAME}' collection where 'organizer' is '${ORGANIZER_ID}'`);
  
  try {
    // Step 1: Query the documents
    console.log('Querying documents...');
    const querySnapshot = await db.collection(COLLECTION_NAME)
                                  .where('organizer', '==', ORGANIZER_ID)
                                  .get();

    console.log(`Query complete. Found ${querySnapshot.size} documents to delete.`);

    if (querySnapshot.empty) {
      console.log('No documents found. Exiting script.');
      return;
    }

    // Step 2: Iterate and delete each document
    const deletePromises = [];
    querySnapshot.forEach((doc) => {
      console.log(`Scheduling deletion for document ID: ${doc.id}`);
      deletePromises.push(doc.ref.delete());
    });

    console.log('Executing deletions...');
    await Promise.all(deletePromises);

    console.log(`Successfully deleted ${deletePromises.length} documents.`);
  } catch (error) {
    console.error('An error occurred during the deletion process:', error);
  } finally {
    console.log('Script execution complete.');
  }
})();