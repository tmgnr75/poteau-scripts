const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const OLD_SELECTION_PATH = 'selections/CnfgCzNnJvXyTLnH1pTK';
const NEW_SELECTION_PATH = 'selections/oymdfi4XthVhjOXEwpj4';
const USERS_COLLECTION = 'users';

(async () => {
  try {
    console.log(`🔍 Starting query for users where favorite_selection is "${OLD_SELECTION_PATH}"`);

    const oldSelectionRef = db.doc(OLD_SELECTION_PATH);
    const newSelectionRef = db.doc(NEW_SELECTION_PATH);

    const snapshot = await db.collection(USERS_COLLECTION)
      .where('favorite_selection', '==', oldSelectionRef)
      .get();

    if (snapshot.empty) {
      console.log('✅ No users found with the old favorite_selection.');
    } else {
      console.log(`🔧 Found ${snapshot.size} user(s) to update.`);

      for (const doc of snapshot.docs) {
        const userId = doc.id;
        console.log(`➡️ Updating user ${userId}...`);

        await db.collection(USERS_COLLECTION).doc(userId).update({
          favorite_selection: newSelectionRef
        });

        console.log(`✅ User ${userId} updated successfully.`);
      }
    }

    console.log(`🗑️ Deleting old selection document: ${OLD_SELECTION_PATH}...`);
    await oldSelectionRef.delete();
    console.log('✅ Old selection document deleted successfully.');

    console.log('🎉 Script completed without errors.');
  } catch (error) {
    console.error('❌ An error occurred:', error);
  }
})();