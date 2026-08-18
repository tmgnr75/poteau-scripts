const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

async function updateEmail(uid, newEmail) {
  try {
    await admin.auth().updateUser(uid, {
      email: newEmail
    });
    console.log('Successfully updated email for user with UID:', uid);
  } catch (error) {
    console.error('Error updating email:', error);
  }
}

// Usage
const uid = '4CPt9QJ6GEQgrpyTuzm8CMK844V2';
const newEmail = 'contact@game13-footindoor.com'; // New email address

updateEmail(uid, newEmail);
