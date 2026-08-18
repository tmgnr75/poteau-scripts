const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

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
    log('Starting script to check and fix accounts field for pro users.');

    // Query all users with type == 'pro'
    const querySnapshot = await db.collection('users')
      .where('type', '==', 'pro')
      .get();

    log(`Query completed. Found ${querySnapshot.size} pro users.`);

    const report = {
      totalProUsers: querySnapshot.size,
      accountsUnset: [],
      accountsCorrect: [],
      accountsIncorrect: [],
      fixed: [],
      errors: []
    };

    // Process each user
    for (const doc of querySnapshot.docs) {
      const userId = doc.id;
      const data = doc.data();
      const accounts = data.accounts;

      try {
        if (!accounts || accounts === undefined) {
          // accounts is unset - need to set it
          log(`User ${userId}: accounts field is unset. Setting to [${userId}]`);

          await doc.ref.update({
            accounts: [userId]
          });

          report.accountsUnset.push({
            userId: userId,
            displayName: data.display_name || null,
            action: 'set accounts to [userId]'
          });
          report.fixed.push(userId);

        } else if (Array.isArray(accounts)) {
          // accounts is set - check if it's correct
          if (accounts.length === 1 && accounts[0] === userId) {
            log(`User ${userId}: accounts field is correct [${userId}]`);
            report.accountsCorrect.push({
              userId: userId,
              displayName: data.display_name || null,
              accounts: accounts
            });
          } else {
            log(`User ${userId}: accounts field is INCORRECT. Expected [${userId}], found [${accounts.join(', ')}]`);
            report.accountsIncorrect.push({
              userId: userId,
              displayName: data.display_name || null,
              currentAccounts: accounts,
              expectedAccounts: [userId]
            });
          }
        } else {
          // accounts exists but is not an array
          log(`User ${userId}: accounts field exists but is not an array. Type: ${typeof accounts}`);
          report.accountsIncorrect.push({
            userId: userId,
            displayName: data.display_name || null,
            currentAccounts: accounts,
            expectedAccounts: [userId],
            issue: 'not an array'
          });
        }
      } catch (error) {
        log(`Error processing user ${userId}:`, error.message);
        report.errors.push({
          userId: userId,
          error: error.message
        });
      }
    }

    // Generate final report
    log('\n\n===== FINAL REPORT =====\n');
    console.log(JSON.stringify(report, null, 2));

    // Summary
    log('\n===== SUMMARY =====');
    log(`Total pro users: ${report.totalProUsers}`);
    log(`Accounts unset (fixed): ${report.accountsUnset.length}`);
    log(`Accounts correct: ${report.accountsCorrect.length}`);
    log(`Accounts incorrect: ${report.accountsIncorrect.length}`);
    log(`Total fixed: ${report.fixed.length}`);
    log(`Errors: ${report.errors.length}`);

  } catch (error) {
    log('An error occurred while running the script:', error);
    console.error(error.stack);
  }
})();
