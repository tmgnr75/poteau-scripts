const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function addPlaceIdToDocs() {
  console.log('🚀 Starting update of place_id field in location_pictures collection...\n');

  const collectionRef = db.collection('location_pictures');

  try {
    console.log('🔍 Fetching all documents in location_pictures...');
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      console.log('⚠️ No documents found in location_pictures collection.');
      return;
    }

    console.log(`✅ ${snapshot.size} documents fetched. Beginning updates...\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const doc of snapshot.docs) {
      const docId = doc.id;

      try {
        console.log(`➡️ Updating document [${docId}] with field { place_id: "${docId}" }...`);
        await collectionRef.doc(docId).update({ place_id: docId });
        console.log(`✅ Successfully updated document [${docId}]\n`);
        successCount++;
      } catch (updateErr) {
        console.error(`❌ Failed to update document [${docId}]:`, updateErr.message);
        failureCount++;
      }
    }

    console.log('🎉 Update process complete.');
    console.log(`🔢 Total documents updated: ${successCount}`);
    console.log(`⚠️ Total failures: ${failureCount}`);
  } catch (err) {
    console.error('🔥 Error fetching documents:', err.message);
  }
}

addPlaceIdToDocs();