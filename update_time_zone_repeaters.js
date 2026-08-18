const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateDocuments() {
  try {
    const repeatersRef = db.collection('repeaters');
    const querySnapshot = await repeatersRef.where('centre', '==', 'LE FIVE Orléans Ingré').get();
    
    querySnapshot.forEach(async (doc) => {
      const docRef = repeatersRef.doc(doc.id);
      await docRef.update({ timeZone: 'Europe/Paris' });
      console.log(`Document with ID ${doc.id} updated successfully.`);
    });

    console.log('All documents updated successfully.');
  } catch (error) {
    console.error('Error updating documents:', error);
  }
}

updateDocuments();
