const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateBellPicture() {
  try {
    const batchSize = 100; // Adjust batch size as needed
    const querySnapshot = await db.collection('connect').where('picture', '==', 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fbell_1f514.png?alt=media&token=9c14f9dc-56fe-44c2-955a-7a5b2ac69f7d').get();

    const updates = [];
    let count = 0;

    querySnapshot.forEach(doc => {
      const connectId = doc.id;
      const updatePromise = db.collection('connect').doc(connectId).update({ picture: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Falert-push.png?alt=media&token=1f693749-6df2-49a5-b577-73109cf2d7d9' });
      updates.push(updatePromise);
      
      count++;
      if (count <= batchSize) {
        console.log(`Updating connect ID: ${connectId}`);
      }
    });

    await Promise.all(updates);

    console.log(`Updated ${updates.length} documents.`);
  } catch (error) {
    console.error('Error updating documents:', error);
  }
}

updateBellPicture();
