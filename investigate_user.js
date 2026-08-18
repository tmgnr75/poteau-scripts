const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

async function investigate() {
  const targetUid = 'skdImcC356gXtpfOKF9IKerIpWO2';

  // 1. Fetch the user document
  console.log('=== TARGET USER ===');
  const userDoc = await db.collection('users').doc(targetUid).get();
  if (!userDoc.exists) {
    console.log('User not found!');
    return;
  }
  const userData = userDoc.data();
  console.log('UID:', targetUid);
  console.log('display_name:', userData.display_name || 'N/A');
  console.log('email:', userData.email || 'N/A');
  console.log('phone_number:', userData.phone_number || 'N/A');
  console.log('photo_url:', userData.photo_url || 'N/A');
  console.log('type:', userData.type || 'N/A');
  console.log('sports:', userData.sports || 'N/A');
  console.log('created_time:', userData.created_time ? userData.created_time.toDate().toISOString() : 'N/A');
  console.log('last_activity_date:', userData.last_activity_date ? userData.last_activity_date.toDate().toISOString() : 'N/A');
  console.log('');

  // 2. Find recent games where this user is an attendee
  // Search games from last 5 days (April 9 - April 13, 2026)
  const startDate = new Date('2026-04-09T00:00:00Z');
  const endDate = new Date('2026-04-14T00:00:00Z');

  const userRef = db.collection('users').doc(targetUid);

  const gamesSnap = await db.collection('games')
    .where('date', '>=', admin.firestore.Timestamp.fromDate(startDate))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate))
    .where('attendees', 'array-contains', userRef)
    .get();

  console.log(`=== GAMES (${startDate.toISOString().slice(0,10)} to ${endDate.toISOString().slice(0,10)}) ===`);
  console.log(`Found ${gamesSnap.size} games with this user as attendee`);
  console.log('');

  if (gamesSnap.empty) {
    // Broader search: all games with this user recently, regardless of location
    console.log('No games found with date filter. Trying broader search (last 14 days)...');
    const broaderStart = new Date('2026-04-01T00:00:00Z');
    const broaderSnap = await db.collection('games')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(broaderStart))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .where('attendees', 'array-contains', userRef)
      .get();
    console.log(`Broader search found ${broaderSnap.size} games`);
    if (broaderSnap.empty) {
      console.log('Still no games found.');
      return;
    }
    await processGames(broaderSnap);
  } else {
    await processGames(gamesSnap);
  }
}

async function processGames(gamesSnap) {
  for (const gameDoc of gamesSnap.docs) {
    const game = gameDoc.data();
    const gameDate = game.date ? game.date.toDate().toISOString() : 'N/A';
    const centreName = game.centre_name || game.centreName || 'N/A';
    const centreAddress = game.centre_address || game.centreAddress || 'N/A';

    console.log('---');
    console.log(`GAME ID: ${gameDoc.id}`);
    console.log(`Date: ${gameDate}`);
    console.log(`Sport: ${game.sport || 'N/A'}`);
    console.log(`Status: ${game.status || 'N/A'}`);
    console.log(`Centre: ${centreName}`);
    console.log(`Address: ${centreAddress}`);
    console.log(`Place ID: ${game.placeId || game.place_id || 'N/A'}`);
    console.log(`Max Players: ${game.maxPlayers || 'N/A'}`);
    console.log(`Current Players: ${game.currentPlayers || 'N/A'}`);

    // Check if it's near "Urban" or "Courcouronnes"
    const locationStr = `${centreName} ${centreAddress}`.toLowerCase();
    const isUrbanOrCourcouronnes = locationStr.includes('urban') || locationStr.includes('courcouronnes');
    if (isUrbanOrCourcouronnes) {
      console.log('*** MATCHES Urban/Courcouronnes filter ***');
    }

    // Fetch all attendees
    const attendees = game.attendees || [];
    console.log(`\nAttendees (${attendees.length}):`);

    for (let i = 0; i < attendees.length; i++) {
      const attendeeRef = attendees[i];
      let attendeeId;
      if (typeof attendeeRef === 'string') {
        attendeeId = attendeeRef;
      } else if (attendeeRef && attendeeRef.path) {
        attendeeId = attendeeRef.path.split('/').pop();
      } else if (attendeeRef && attendeeRef.id) {
        attendeeId = attendeeRef.id;
      } else {
        console.log(`  ${i + 1}. [Unknown reference format]`);
        continue;
      }

      try {
        const attendeeDoc = await db.collection('users').doc(attendeeId).get();
        if (attendeeDoc.exists) {
          const a = attendeeDoc.data();
          const isTarget = attendeeId === 'skdImcC356gXtpfOKF9IKerIpWO2';
          console.log(`  ${i + 1}. ${isTarget ? '>>> ' : ''}${a.display_name || 'N/A'} | email: ${a.email || 'N/A'} | phone: ${a.phone_number || 'N/A'} | uid: ${attendeeId}${isTarget ? ' <<< TARGET' : ''}`);
        } else {
          console.log(`  ${i + 1}. [User doc not found] uid: ${attendeeId}`);
        }
      } catch (err) {
        console.log(`  ${i + 1}. [Error fetching user] uid: ${attendeeId}: ${err.message}`);
      }
    }
    console.log('');
  }
}

investigate().then(() => {
  console.log('Done.');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
