const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const auth = admin.auth();

(async () => {
  try {
    console.log(`[INFO] Firebase initialized for project: ${PROJECT_ID}`);

    // Define user data
    const email = 'philippe@tbirdprod.com';
    const userId = 'Vlf3qN9iPMf3ifDbveZ8o7lg1fh2';
    const displayName = 'Philippe Mineur';
    
    console.log(`[INFO] Checking if user with email ${email} already exists...`);

    // Check if user exists in Firebase Authentication
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      console.log(`[INFO] User already exists in Firebase Auth: ${userRecord.uid}`);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.log(`[INFO] User not found in Firebase Auth, creating...`);
        // Create user in Firebase Authentication
        userRecord = await auth.createUser({
          uid: userId, // Assign predefined UID
          email: email,
          displayName: displayName,
          emailVerified: true, // Since auth_email is true
        });
        console.log(`[SUCCESS] User created in Firebase Auth: ${userRecord.uid}`);
      } else {
        throw error; // Re-throw other unexpected errors
      }
    }

    // Create user document in Firestore
    const userData = {
      email: email,
      uid: userId,
      auth_email: true,
      connector: 'google',
      created_time: admin.firestore.Timestamp.now(),
      display_name: displayName,
      gender: 'man',
    };

    console.log(`[INFO] Storing user data in Firestore...`);
    await db.collection('users').doc(userId).set(userData);

    console.log(`[SUCCESS] User successfully stored in Firestore with ID: ${userId}`);
  } catch (error) {
    console.error(`[ERROR] Failed to create/authenticate user:`, error);
  } finally {
    console.log(`[INFO] Closing Firebase connection.`);
    process.exit();
  }
})();