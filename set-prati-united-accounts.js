const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Prati United user ID
const PRATI_UNITED_ID = 'zCvsukfMuuffsuPpSTQwb7MusMD2';

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
    log('Starting script to update Prati United with all pro user IDs.');

    // Query all users with type == 'pro'
    const querySnapshot = await db.collection('users')
      .where('type', '==', 'pro')
      .get();

    log(`Query completed. Found ${querySnapshot.size} pro users.`);

    // Collect all pro user IDs
    const allProUserIds = [];
    querySnapshot.docs.forEach(doc => {
      allProUserIds.push(doc.id);
    });

    log(`Collected ${allProUserIds.length} pro user IDs.`);
    log('Pro user IDs:', allProUserIds);

    // Update Prati United's accounts field
    log(`\nUpdating Prati United (${PRATI_UNITED_ID}) with all pro user IDs...`);

    const pratiUnitedRef = db.collection('users').doc(PRATI_UNITED_ID);

    // Get current data
    const pratiUnitedDoc = await pratiUnitedRef.get();
    if (!pratiUnitedDoc.exists) {
      log(`ERROR: Prati United user document not found!`);
      return;
    }

    const currentData = pratiUnitedDoc.data();
    log(`Current Prati United accounts:`, currentData.accounts);

    // Update the accounts field
    await pratiUnitedRef.update({
      accounts: allProUserIds
    });

    log(`\nSuccessfully updated Prati United's accounts field!`);

    // Verify the update
    const updatedDoc = await pratiUnitedRef.get();
    const updatedAccounts = updatedDoc.data().accounts;

    log(`\nVerification - Updated accounts array (${updatedAccounts.length} items):`, updatedAccounts);

    // Final report
    const report = {
      pratiUnitedId: PRATI_UNITED_ID,
      pratiUnitedName: currentData.display_name || null,
      totalProUsers: querySnapshot.size,
      accountsArrayLength: updatedAccounts.length,
      previousAccounts: currentData.accounts || [],
      updatedAccounts: updatedAccounts,
      allProUserIds: allProUserIds
    };

    log('\n\n===== FINAL REPORT =====\n');
    console.log(JSON.stringify(report, null, 2));

    log('\n===== SUMMARY =====');
    log(`Prati United (${PRATI_UNITED_ID}) has been updated`);
    log(`Previous accounts count: ${currentData.accounts ? currentData.accounts.length : 0}`);
    log(`New accounts count: ${updatedAccounts.length}`);
    log(`All ${querySnapshot.size} pro user IDs have been added to the accounts array`);

  } catch (error) {
    log('An error occurred while running the script:', error);
    console.error(error.stack);
  }
})();
