const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID
const amplitude = require('@amplitude/analytics-node');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Initialize the Amplitude client
amplitude.init('57f03efbb1dfde7b97bb291b7eafa32f');

// Define the data for the new document
const newData = {
  message: "Get prepared to welcome the 10 players from Poteau, tomorrow at 6pm. That means $140 of revenue!",
  datetime: admin.firestore.FieldValue.serverTimestamp(),
  status: "published",
  title: "YOUR GAME IS FULL 👊",
  destination: "https://poteau.pro/update",
  recipient: [
    db.doc('/users/zCvsukfMuuffsuPpSTQwb7MusMD2')
  ]
};

// Add a new document to the "connect" collection
db.collection("connect")
  .add(newData)
  .then((docRef) => {
    console.log("Document written with ID: ", docRef.id);

    // Extract recipient IDs from the array of DocRef objects
    const recipientIds = newData.recipient.map((docRef) => docRef.id);

    // Iterate through recipient IDs and send an event for each one
    recipientIds.forEach((thisUserId) => {
      console.log("Sending event to Amplitude for user_id: ", thisUserId);

      // Send the event to Amplitude
      const eventProperties = {
        title: newData.title,
        message: newData.message,
        destination: newData.destination,
      };

      amplitude.track('Push received', eventProperties, {
        user_id: thisUserId,
        device_id: 'backend',
      });

      console.log("Event sent to Amplitude for user_id: ", thisUserId);
    });
  })
  .catch((error) => {
    console.error("Error adding document: ", error);
  });
