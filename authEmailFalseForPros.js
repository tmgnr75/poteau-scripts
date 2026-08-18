const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log('[START] Script to update auth_email to false for all pro users');

  const usersRef = db.collection('users');
  console.log('[QUERY] Fetching all users where type == "pro"');

  try {
    const snapshot = await usersRef.where('type', '==', 'pro').get();

    if (snapshot.empty) {
      console.log('[RESULT] No user with type "pro" found.');
      return;
    }

    console.log(`[RESULT] Found ${snapshot.size} pro user(s). Starting update process.`);

    let successCount = 0;
    let failCount = 0;

    for (const doc of snapshot.docs) {
      const docRef = doc.ref;
      const userId = doc.id;

      try {
        console.log(`[UPDATE] Setting auth_email == false for user ${userId}`);
        await docRef.update({ auth_email: false });
        console.log(`[SUCCESS] Updated user ${userId}`);
        successCount++;
      } catch (updateError) {
        console.error(`[ERROR] Failed to update user ${userId}`, updateError);
        failCount++;
      }
    }

    console.log('[COMPLETE] Update process finished.');
    console.log(`[SUMMARY] Success: ${successCount} | Failed: ${failCount}`);

  } catch (error) {
    console.error('[FATAL] Error during Firestore query:', error);
  }
})();