// Import necessary modules
const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

// Firestore reference
const db = admin.firestore();

// File path for output
const txtFilePath = 'users-data.txt';

// Create a writable file stream for the .txt file
const fileStream = fs.createWriteStream(txtFilePath);

// Write header row to the .txt file
fileStream.write('uid,email,phone,fn,ln,ct,country\n');

// Function to sanitize data by removing commas
function sanitizeData(data) {
  return data ? data.replace(/,/g, '') : '';
}

// Fetch users from Firestore with pagination support
async function fetchUsersFromFirestore(startAfter = null) {
  try {
    const pageSize = 1000; // Fetch 1000 users per query
    let query = db.collection('users').limit(pageSize);

    if (startAfter) {
      query = query.startAfter(startAfter); // For pagination
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('No more documents.');
      return;
    }

    // Process each user document
    snapshot.forEach(doc => {
      const userData = doc.data();

      const uid = doc.id || '';  // Document ID is used as UID
      const email = userData.email || '';  // Email
      const phoneNumber = userData.phone_number || '';  // Phone number
      const firstName = sanitizeData(userData.first_name || '');  // First name, sanitized for commas
      const lastName = sanitizeData(userData.last_name || '');  // Last name, sanitized for commas
      const lastAddress = sanitizeData(userData.last_address || '');  // Last address, sanitized for commas
      const country = 'FR';  // Static country value

      // Write the user data to the .txt file
      fileStream.write(`${uid},${email},${phoneNumber},${firstName},${lastName},${lastAddress},${country}\n`);
    });

    // Fetch the next batch if there are more documents
    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size === pageSize) {
      console.log(`Fetching next batch after ${lastDoc.id}...`);
      await fetchUsersFromFirestore(lastDoc); // Fetch next batch
    } else {
      console.log('All users processed. Export completed.');
      fileStream.end();
    }
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
    fileStream.end(); // Ensure the file stream is closed on error
  }
}

// Start fetching users from Firestore
console.log('Starting user export from Firestore...');
fetchUsersFromFirestore().then(() => {
  console.log('User export script finished.');
}).catch((error) => {
  console.error('Unexpected error during export:', error.message);
  fileStream.end();
});