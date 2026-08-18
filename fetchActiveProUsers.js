const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Collection name
const COLLECTION_NAME = 'users';

// Main function to fetch and filter user documents
async function fetchActiveProUsers() {
  console.log(`Starting script to fetch active 'pro' users from Firestore project: ${PROJECT_ID}`);

  try {
    console.log(`Querying the Firestore collection: ${COLLECTION_NAME}`);

    // Query the collection and only select required fields
    const querySnapshot = await db.collection(COLLECTION_NAME)
      .where('type', '==', 'pro')
      .where('centre_plan_status', '==', 'active')
      .select('display_name', 'short_name') // Only select required fields
      .get();

    console.log(`Query completed. Found ${querySnapshot.size} matching documents.`);

    if (querySnapshot.empty) {
      console.log('No documents found matching the criteria.');
      return;
    }

    // Consolidate all users into a single JSON object
    const users = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      display_name: doc.data().display_name || null,
      short_name: doc.data().short_name || null,
    }));

    // Log the final JSON output
    console.log('All matching documents fetched successfully. Here is the consolidated JSON:');
    const output = { users };
    console.log(JSON.stringify(output, null, 2));
    return output;

  } catch (error) {
    console.error('An error occurred while fetching documents:', error.message);
    console.error(error.stack);
  }
}

// Execute the function
fetchActiveProUsers();