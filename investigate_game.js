const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

async function investigate() {
  const gameId = 'Fjapuw462bC6rOCQ0vmh';

  // 1. Get the game document
  const gameDoc = await db.collection('games').doc(gameId).get();

  if (!gameDoc.exists) {
    console.log('Game document does not exist!');
    return;
  }

  const gameData = gameDoc.data();
  console.log('=== GAME DOCUMENT ===');
  console.log('ID:', gameId);
  console.log('Full data:', JSON.stringify(gameData, (key, value) => {
    if (value && value._seconds !== undefined) {
      return new Date(value._seconds * 1000).toISOString();
    }
    if (value && value._path) {
      return value._path.segments.join('/');
    }
    return value;
  }, 2));

  // 2. Get the organizer's user document
  const organizerRef = gameData.organizer;
  if (organizerRef) {
    const organizerId = typeof organizerRef === 'string' ? organizerRef : organizerRef.id || organizerRef._path?.segments?.slice(-1)[0];
    console.log('\n=== ORGANIZER ===');
    console.log('Organizer ID:', organizerId);

    if (organizerId) {
      const userDoc = await db.collection('users').doc(organizerId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log('Display name:', userData.display_name);
        console.log('Type:', userData.type);
        console.log('Ambassador:', userData.ambassador);
        console.log('Email:', userData.email);
        console.log('Centre name:', userData.centre_name);
        console.log('Centre payment type:', userData.centre_payment_type);
      }
    }
  }

  // 3. Key fields summary
  console.log('\n=== KEY FIELDS ===');
  console.log('payment_type:', gameData.payment_type);
  console.log('type:', gameData.type);
  console.log('status:', gameData.status);
  console.log('sport:', gameData.sport);
  console.log('date:', gameData.date);
  console.log('created_on:', gameData.created_on);
  console.log('visibility:', gameData.visibility);

  process.exit(0);
}

investigate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
