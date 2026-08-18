const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const USERS_COLLECTION = 'users';
const AUTH_EMAIL_FIELD = 'auth_email';

/**
 * Queries the users collection for documents where auth_email is true
 * and returns the count.
 */
async function countUsersWithAuthEmail() {
  console.log(`[INFO] Starting query to count users with '${AUTH_EMAIL_FIELD} == true' in '${USERS_COLLECTION}' collection.`);
  try {
    const usersRef = db.collection(USERS_COLLECTION);
    const querySnapshot = await usersRef.where(AUTH_EMAIL_FIELD, '==', true).get();
    
    if (querySnapshot.empty) {
      console.log(`[INFO] No users found with '${AUTH_EMAIL_FIELD} == true'. Returning count as 0.`);
      return 0;
    }
    
    console.log(`[SUCCESS] Found ${querySnapshot.size} users with '${AUTH_EMAIL_FIELD} == true'.`);
    return querySnapshot.size;
  } catch (error) {
    console.error(`[ERROR] Failed to execute query:`, error);
    throw error;
  }
}

// Execute function and log result
countUsersWithAuthEmail()
  .then(count => console.log(`[RESULT] Total users with '${AUTH_EMAIL_FIELD} == true': ${count}`))
  .catch(err => console.error(`[FATAL] An error occurred:`, err));