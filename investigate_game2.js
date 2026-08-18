const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
  });
}

const db = admin.firestore();

async function investigate() {
  const userId = 'bsNdQGYvUPa9mgl9fWcXDguw8J12';

  // 1. Full user document
  const userDoc = await db.collection('users').doc(userId).get();
  if (userDoc.exists) {
    const data = userDoc.data();
    console.log('=== FULL USER DOCUMENT ===');
    console.log(JSON.stringify(data, (key, value) => {
      if (value && value._seconds !== undefined) {
        return new Date(value._seconds * 1000).toISOString();
      }
      if (value && value._path) {
        return value._path.segments.join('/');
      }
      return value;
    }, 2));
  }

  // 2. Check if any script updated this game's payment_type
  // Look for other games by this user
  console.log('\n=== OTHER GAMES BY THIS USER ===');
  const gamesSnap = await db.collection('games')
    .where('organizer', '==', userId)
    .limit(10)
    .get();

  gamesSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Game ${doc.id}: payment_type=${d.payment_type}, type=${d.type}, status=${d.status}, date=${d.date?._seconds ? new Date(d.date._seconds * 1000).toISOString() : d.date}`);
  });

  // 3. Check the scripts that batch-update payment types
  // Check set_in_app_payments.js and updatePaymentTypePro.js for this centre or user

  process.exit(0);
}

investigate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
