const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log(`[START] Script started at ${new Date().toISOString()}`);
  const organizerId = 'ZmXMWx7aTdPoPkkGOWa2HIQVblq2';
  const now = new Date();

  try {
    console.log(`[GAMES] Querying games for organizer=${organizerId}, status=published, date > now…`);
    const gamesSnap = await db.collection('games')
      .where('organizer', '==', organizerId)
      .where('status', '==', 'published')
      .where('date', '>', now)
      .get();

    console.log(`[GAMES] Found ${gamesSnap.size} games to process.`);

    for (const doc of gamesSnap.docs) {
      const gameData = doc.data();
      const docId = doc.id;
      const attendees = gameData.attendees;

      console.log(`\n[GAMES] Processing game ${docId} with date ${gameData.date.toDate?.() || gameData.date}`);
      if (!attendees || (Array.isArray(attendees) && attendees.length === 0)) {
        console.log(`[GAMES] No attendees set. Updating payment_type to "in-app".`);
        await db.collection('games').doc(docId).update({
          payment_type: 'in-app',
        });
        console.log(`[GAMES] ✅ Updated game ${docId} payment_type to "in-app".`);
      } else {
        console.log(`[GAMES] Attendees present (${attendees.length}). Canceling game and cloning…`);
        await db.collection('games').doc(docId).update({
          status: 'canceled',
        });
        console.log(`[GAMES] ✅ Game ${docId} status updated to canceled.`);

        // clone data
        const newGameData = { ...gameData, payment_type: 'in-app' };
        delete newGameData.id; // ensure no id field if present
        // Keep original timestamps
        const newGameRef = db.collection('games').doc();
        await newGameRef.set(newGameData);
        console.log(`[GAMES] ✅ Cloned game ${docId} to new game ${newGameRef.id} with payment_type="in-app".`);
      }
    }

    console.log(`[REPEATERS] Querying repeaters for organizer=${organizerId}…`);
    const repeatersSnap = await db.collection('repeaters')
      .where('organizer', '==', organizerId)
      .get();
    console.log(`[REPEATERS] Found ${repeatersSnap.size} repeaters.`);

    for (const doc of repeatersSnap.docs) {
      const repId = doc.id;
      console.log(`[REPEATERS] Updating paymentType for repeater ${repId}…`);
      await db.collection('repeaters').doc(repId).update({
        paymentType: 'in-app',
      });
      console.log(`[REPEATERS] ✅ Repeater ${repId} paymentType updated to "in-app".`);
    }

    console.log(`[END] Script completed successfully at ${new Date().toISOString()}`);
  } catch (err) {
    console.error(`[ERROR] ${err.message}`, err);
  }
})();