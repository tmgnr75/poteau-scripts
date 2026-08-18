const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Helper function to log contextual information
const log = (message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(data);
  }
};

(async () => {
  try {
    log('Starting the query for users with type "pro" and centre_plan_status "active".');
    
    // Query the Firestore users collection
    const querySnapshot = await db.collection('users')
      .where('type', '==', 'pro')
      .where('centre_plan_status', '==', 'active')
      .get();

    log(`Query completed. Found ${querySnapshot.size} matching documents.`);

    const results = [];

    if (querySnapshot.empty) {
      log('No matching documents found.');
    } else {
      log('Processing and collecting results into JSON format:');
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const user = {
          id: doc.id,
          centre_place_id: data.centre_place_id || null,
          photo_url: data.photo_url || null,
          display_name: data.display_name || null,
        };
        results.push(user);
      });
    }

    log('Query processing complete. Final JSON result:');
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    log('An error occurred while querying Firestore.', error);
  }
})();