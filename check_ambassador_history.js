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
  const gameId = 'Fjapuw462bC6rOCQ0vmh';

  // 1. Check the draft_games collection for any draft matching this user and date
  console.log('=== CHECKING DRAFT GAMES ===');
  const draftsSnap = await db.collection('draft_games')
    .where('organizer', '==', userId)
    .limit(10)
    .get();
  
  console.log(`Found ${draftsSnap.size} draft(s) by this user`);
  draftsSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Draft ${doc.id}:`, JSON.stringify({
      payment_type: d.payment_type,
      type: d.type,
      sport: d.sport,
      date: d.date?._seconds ? new Date(d.date._seconds * 1000).toISOString() : d.date,
      centre: d.centre,
    }));
  });

  // 2. Check if this game was maybe created by a different path (e.g., index.js old createGame)
  // Check if there's a repeater linked
  console.log('\n=== CHECKING REPEATERS ===');
  const repSnap = await db.collection('repeaters')
    .where('organizer', '==', userId)
    .limit(5)
    .get();
  console.log(`Found ${repSnap.size} repeater(s) by this user`);
  repSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Repeater ${doc.id}:`, JSON.stringify(d, (key, value) => {
      if (value && value._seconds !== undefined) return new Date(value._seconds * 1000).toISOString();
      if (value && value._path) return value._path.segments.join('/');
      return value;
    }));
  });

  // 3. Check the centre "We Are Sports" — maybe it's a pro centre with in-app setting
  console.log('\n=== CHECKING CENTRE "We Are Sports" ===');
  const centresSnap = await db.collection('centres')
    .where('name', '==', 'We Are Sports')
    .limit(5)
    .get();
  console.log(`Found ${centresSnap.size} centre(s)`);
  centresSnap.forEach(doc => {
    const d = doc.data();
    console.log(`Centre ${doc.id}:`, JSON.stringify(d, (key, value) => {
      if (value && value._seconds !== undefined) return new Date(value._seconds * 1000).toISOString();
      if (value && value._path) return value._path.segments.join('/');
      return value;
    }, 2));
  });

  // 4. Also check if any pro user owns this centre and has in-app payment
  console.log('\n=== CHECKING PRO USERS WITH "We Are Sports" ===');
  const proSnap = await db.collection('users')
    .where('centre_name', '==', 'We Are Sports')
    .limit(5)
    .get();
  console.log(`Found ${proSnap.size} pro(s) with this centre`);
  proSnap.forEach(doc => {
    const d = doc.data();
    console.log(`User ${doc.id}: type=${d.type}, centre_payment_type=${d.centre_payment_type}, ambassador=${d.ambassador}`);
  });

  process.exit(0);
}

investigate().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
