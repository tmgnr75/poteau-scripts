const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Centre names that should have priority 2
const PRIORITY_2_KEYWORDS = [
  'LE FIVE',
  '4PADEL',
  'Soctainer',
  'Stadium ',
  'IMPULSTAR',
  'Argenteuil'
];

async function checkAndFixPriorityCentres() {
  console.log('Starting the script to check and fix priority for specific centres in "cached_centres" collection.');
  console.log(`Priority 2 will be set for centres containing: ${PRIORITY_2_KEYWORDS.join(', ')}`);

  const collectionName = 'cached_centres';
  let checkedCount = 0;
  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let errorCount = 0;

  try {
    console.log(`\nFetching all documents from the "${collectionName}" collection...`);
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`No documents found in the "${collectionName}" collection. Exiting script.`);
      return;
    }

    console.log(`Found ${snapshot.size} documents in the "${collectionName}" collection.`);
    console.log('Starting to check each document...\n');

    for (const doc of snapshot.docs) {
      const docId = doc.id;
      const docData = doc.data();
      const centreName = docData.centre_name || '';
      const currentPriority = docData.priority;

      checkedCount++;

      // Check if centre_name contains any of the priority 2 keywords
      const shouldHavePriority2 = PRIORITY_2_KEYWORDS.some(keyword =>
        centreName.includes(keyword)
      );

      if (shouldHavePriority2) {
        console.log(`\n📍 Found matching centre: "${centreName}" (ID: ${docId})`);
        console.log(`   Current priority: ${currentPriority === undefined || currentPriority === null ? 'UNSET/EMPTY' : currentPriority}`);

        // Check if priority is not 2 (including undefined, null, or any other value)
        if (currentPriority !== 2) {
          console.log(`   ⚠️  Priority needs to be set to 2...`);
          try {
            await db.collection(collectionName).doc(docId).update({ priority: 2 });
            console.log(`   ✅ Successfully updated priority to 2`);
            updatedCount++;
          } catch (error) {
            console.error(`   ❌ Error updating document: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`   ✅ Priority is already correct (2)`);
          alreadyCorrectCount++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total documents checked: ${checkedCount}`);
    console.log(`Matching centres found: ${updatedCount + alreadyCorrectCount + errorCount}`);
    console.log(`Already had priority 2: ${alreadyCorrectCount}`);
    console.log(`Updated to priority 2: ${updatedCount}`);
    console.log(`Errors: ${errorCount}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error(`\n❌ An error occurred while processing the "${collectionName}" collection: ${error.message}`);
  }
}

checkAndFixPriorityCentres().then(() => {
  console.log('\n✅ Script execution finished.');
  process.exit(0);
}).catch((error) => {
  console.error(`\n❌ Unhandled error in the script: ${error.message}`);
  process.exit(1);
});
