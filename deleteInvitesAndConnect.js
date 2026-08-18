const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Reference to the target game document
const gameRef = db.collection("games").doc("rWuBdzHRI42Il8MX6g5I");

async function deleteDocuments(collectionName, gameRef) {
  console.log(`🔍 Querying ${collectionName} where game == ${gameRef.path}`);

  try {
    const snapshot = await db.collection(collectionName)
      .where("game", "==", gameRef)
      .get();

    if (snapshot.empty) {
      console.log(`✅ No documents found in ${collectionName} for gameRef.`);
      return;
    }

    console.log(`🗑️ Found ${snapshot.size} documents to delete in ${collectionName}.`);

    let batch = db.batch();
    let count = 0;

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      count++;

      // Firestore batches have a limit of 500 operations, so commit & restart if needed
      if (count % 500 === 0) {
        console.log("⚡ Committing batch of 500 deletes...");
        batch.commit();
        batch = db.batch();
      }
    });

    // Commit remaining deletes
    if (count % 500 !== 0) {
      console.log(`⚡ Committing final batch of ${count % 500} deletes...`);
      await batch.commit();
    }

    console.log(`✅ Successfully deleted ${count} documents from ${collectionName}.`);
  } catch (error) {
    console.error(`❌ Error deleting documents in ${collectionName}:`, error);
  }
}

async function main() {
  console.log("🚀 Starting deletion process...");

  await deleteDocuments("game_invitations", gameRef);
  await deleteDocuments("connect", gameRef);

  console.log("🎯 Deletion process completed.");
}

main();