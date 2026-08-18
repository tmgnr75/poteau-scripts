const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const updateLanguageForUsers = async () => {
  console.log("=== Starting language update script ===");
  
  try {
    // Query all users where country_code == "US"
    console.log("Querying users with country_code = 'US'...");
    const usersSnapshot = await db.collection("users")
      .where("last_address", "==", "San Francisco, CA, USA")
      .get();

    if (usersSnapshot.empty) {
      console.log("No users found with country_code = 'US'. Exiting.");
      return;
    }

    console.log(`Found ${usersSnapshot.size} users with country_code = 'US'. Processing...`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const displayName = userData.display_name || "Unknown";

      console.log(`Processing user ID: ${userId}, display_name: "${displayName}"`);
      
      if (!userData.language) {
        console.log(`Language not set for user ID: ${userId}, display_name: "${displayName}". Updating to 'en'...`);
        await doc.ref.update({ language: "en" });
        updatedCount++;
        console.log(`Successfully updated user ID: ${userId}, display_name: "${displayName}" with language = 'en'.`);
      } else {
        console.log(`Language already set for user ID: ${userId}, display_name: "${displayName}" (language = ${userData.language}). Skipping update.`);
        skippedCount++;
      }
    }

    console.log(`=== Script Summary ===`);
    console.log(`Total users processed: ${usersSnapshot.size}`);
    console.log(`Users updated: ${updatedCount}`);
    console.log(`Users skipped: ${skippedCount}`);
    console.log("=== Language update script completed successfully ===");
  } catch (error) {
    console.error("An error occurred while updating users:", error);
  }
};

updateLanguageForUsers();