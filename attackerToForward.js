const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const COLLECTION_NAME = 'quiz_questions';
const OLD_ROLE = 'attacker';
const NEW_ROLE = 'forward';

(async () => {
  console.log('--- Script Start ---');
  console.log(`Target: Update all '${COLLECTION_NAME}' where role == '${OLD_ROLE}' to '${NEW_ROLE}'`);

  try {
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where('role', '==', OLD_ROLE)
      .get();

    console.log(`Fetched ${snapshot.size} document(s) with role == '${OLD_ROLE}'`);

    if (snapshot.empty) {
      console.log('No documents found. Nothing to update.');
      console.log('--- Script End ---');
      return;
    }

    let updatedCount = 0;
    const batch = db.batch();

    snapshot.docs.forEach((doc, idx) => {
      const docRef = doc.ref;
      const data = doc.data();

      console.log(`[${idx + 1}/${snapshot.size}] Queuing update for doc ID: ${doc.id}`);
      console.log(` - Current role: ${data.role}`);
      console.log(` - Changing role to: ${NEW_ROLE}`);

      batch.update(docRef, { role: NEW_ROLE });
      updatedCount++;
    });

    await batch.commit();

    console.log(`Successfully updated ${updatedCount} document(s).`);
  } catch (error) {
    console.error('❌ Error during Firestore update:', error);
  }

  console.log('--- Script End ---');
})();