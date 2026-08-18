const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});


// Function to add documents to the "cached_centres" collection
async function addDocumentsToCachedCentres() {
  try {
    const db = admin.firestore();
    const batch = db.batch();

    const centreData = [
      { centre_name: 'Élite 5 Soccer', centre_place_id: 'ChIJ5-jfdlZk5kcRYIaELgvikaM' },
      { centre_name: 'FOOT IN FIVE', centre_place_id: 'ChIJoUR0syFp5kcRUlStnwluaYY' }
    ];

    const collectionRef = db.collection('cached_centres');

    centreData.forEach((data) => {
      const docRef = collectionRef.doc(); // Auto-generate document ID
      batch.set(docRef, data);
    });

    await batch.commit();
    console.log('Documents added to cached_centres collection successfully.');
  } catch (error) {
    console.error('Error adding documents:', error);
  }
}

// Call the function to add the documents
addDocumentsToCachedCentres();
