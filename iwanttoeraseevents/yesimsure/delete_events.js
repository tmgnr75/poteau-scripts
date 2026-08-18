const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});


const collectionRef = admin.firestore().collection('games');

async function deleteDocuments() {
  // Get a list of all documents in the collection
  const documents = await collectionRef.listDocuments();

  // Delete each document
  documents.forEach((document) => {
    document.delete();
  });
}

deleteDocuments();
