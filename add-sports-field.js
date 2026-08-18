const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const usersRef = db.collection('users');

const BATCH_SIZE = 500; // Firestore batch limit
let lastProcessedDoc = null;
let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;
let totalUsers = 0;

async function countTotalUsers() {
  const snapshot = await usersRef.count().get();
  return snapshot.data().count;
}

async function addSportsField() {
  try {
    let query = usersRef.orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);

    if (lastProcessedDoc) {
      query = query.startAfter(lastProcessedDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('\n✅ Migration complete!');
      console.log(`Total processed: ${totalProcessed}`);
      console.log(`Total updated: ${totalUpdated}`);
      console.log(`Total skipped (already had field): ${totalSkipped}`);
      return;
    }

    let batch = db.batch();
    let batchCount = 0;

    snapshot.forEach(doc => {
      const userData = doc.data();

      // Only update if the user doesn't have a sports field
      if (!userData.hasOwnProperty('sports')) {
        batch.update(doc.ref, {
          sports: ['soccer', 'padel']
        });
        batchCount++;
        totalUpdated++;
      } else {
        totalSkipped++;
      }
    });

    // Only commit if there are updates
    if (batchCount > 0) {
      await batch.commit();
    }

    lastProcessedDoc = snapshot.docs[snapshot.docs.length - 1];
    totalProcessed += snapshot.size;

    const progressPercent = ((totalProcessed / totalUsers) * 100).toFixed(2);
    console.log(
      `Progress: ${totalProcessed}/${totalUsers} (${progressPercent}%) | ` +
      `Updated: ${totalUpdated} | Skipped: ${totalSkipped} | ` +
      `Last ID: ${lastProcessedDoc.id}`
    );

    if (snapshot.size >= BATCH_SIZE) {
      // Continue processing next batch immediately
      setImmediate(addSportsField);
    } else {
      console.log('\n✅ Migration complete!');
      console.log(`Total processed: ${totalProcessed}`);
      console.log(`Total updated: ${totalUpdated}`);
      console.log(`Total skipped (already had field): ${totalSkipped}`);
    }
  } catch (error) {
    console.error('❌ Error updating users:', error);
    console.log(`\nYou can resume from document ID: ${lastProcessedDoc?.id || 'beginning'}`);
    process.exit(1);
  }
}

(async () => {
  console.log('🚀 Starting sports field migration...\n');
  totalUsers = await countTotalUsers();
  console.log(`Total users to process: ${totalUsers.toLocaleString()}\n`);
  addSportsField();
})();
