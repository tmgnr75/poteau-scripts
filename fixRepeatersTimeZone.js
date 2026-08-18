const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log('[START] Searching for repeaters with invalid timeZone');

  const snapshot = await db
    .collection('repeaters')
    .where('timeZone', '==', 'heure normale d’Europe centrale')
    .get();

  console.log(`[INFO] Found ${snapshot.size} repeaters to update`);

  for (const doc of snapshot.docs) {
    const id = doc.id;
    console.log(`[UPDATE] Replacing timeZone for repeater ${id} -> Europe/Paris`);
    await doc.ref.update({ timeZone: 'Europe/Paris' });
  }

  console.log('[DONE] All matching repeaters updated.');
})();