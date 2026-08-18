const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async function updateLongAddresses() {
  try {
    console.log("Starting to query users...");
    const usersRef = db.collection('users');
    const snapshot = await usersRef.orderBy('created_time', 'desc').limit(10000).get();

    if (snapshot.empty) {
      console.log("No user documents found.");
      return;
    }

    console.log(`Processing ${snapshot.size} user documents...`);

    let totalUsersWithLastAddress = 0;
    let usersUpdated = 0;

    const batch = db.batch(); // For batch updates
    const maxBatchSize = 500; // Firestore batch limit
    let batchCount = 0;

    snapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.last_address) {
        totalUsersWithLastAddress++;
        const firstCommaIndex = userData.last_address.indexOf(',');
        const charactersBeforeComma = firstCommaIndex !== -1 ? firstCommaIndex : userData.last_address.length;

        if (charactersBeforeComma > 30) {
          const originalValue = userData.last_address;
          const truncatedValue = originalValue.slice(0, 25) + '...';

          console.log(`User ID: ${doc.id}`);
          console.log(`Original last_address: ${originalValue}`);
          console.log(`Updated last_address: ${truncatedValue}`);

          // Add update to batch
          batch.update(doc.ref, { last_address: truncatedValue });
          usersUpdated++;
          batchCount++;

          // Commit batch if it reaches the limit
          if (batchCount === maxBatchSize) {
            batch.commit();
            console.log("Committed batch of 500 updates.");
            batchCount = 0;
          }
        }
      }
    });

    // Commit any remaining updates in the batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Committed final batch of ${batchCount} updates.`);
    }

    console.log(`Total users with 'last_address' set: ${totalUsersWithLastAddress}`);
    console.log(`Total users updated: ${usersUpdated}`);
  } catch (error) {
    console.error("Error querying or updating users:", error);
  }
})();