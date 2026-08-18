const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateUsersCentreCountry() {
  console.log('Script initialized.');
  console.log('Connecting to Firestore...');
  
  try {
    // Reference to the 'users' collection
    const usersRef = db.collection('users');
    console.log('Users collection reference obtained.');

    // Query to find all docs where type = 'pro' and status = 'active'
    console.log("Querying for documents where 'type' is 'pro' and 'status' is 'active'...");
    const snapshot = await usersRef
      .where('type', '==', 'pro')
      .where('centre_plan_status', '==', 'active')
      .get();

    // Check if any documents were found
    if (snapshot.empty) {
      console.log('No matching documents found.');
      return;
    }

    console.log(`Found ${snapshot.size} matching document(s). Preparing to update...`);
    const updatePromises = [];

    // Loop through each document to update it
    snapshot.forEach((doc) => {
      const displayName = doc.get('display_name');
      console.log(`Updating document with display_name: ${displayName}`);
      
      updatePromises.push(
        doc.ref.update({ centre_country: 'France' })
          .then(() => console.log(`Successfully updated document with display_name: ${displayName}`))
          .catch((error) => console.error(`Error updating document with display_name: ${displayName}`, error))
      );
    });

    console.log('All update requests have been sent. Waiting for completion...');
    await Promise.all(updatePromises);
    console.log('All updates completed successfully. centre_country set to France for all matching documents.');

  } catch (error) {
    console.error('An error occurred during the update process:', error);
  } finally {
    console.log('Script execution finished.');
  }
}

// Run the update function
updateUsersCentreCountry();