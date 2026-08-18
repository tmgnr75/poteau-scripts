const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function cleanUpRepeaters() {
  try {
    console.log('Starting cleanup process for organizer JfJC0qd2OvO5Lb10A6Ia4SuKmAa2...');

    // Query all repeater docs for the organizer
    const repeatersSnapshot = await db.collection('repeaters')
      .where('organizer', '==', 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2')
      .get();

    if (repeatersSnapshot.empty) {
      console.log('No repeaters found for the specified organizer. Exiting script.');
      return;
    }

    console.log(`Found ${repeatersSnapshot.size} repeaters. Processing each repeater...`);

    for (const repeaterDoc of repeatersSnapshot.docs) {
      const repeaterRef = repeaterDoc.ref;
      console.log(`Processing repeater: ${repeaterRef.id}`);

      // Query games linked to this repeater with date > now
      const now = new Date();
      const gamesSnapshot = await db.collection('games')
        .where('repeater', '==', repeaterRef)
        .where('date', '>', now)
        .get();

      if (gamesSnapshot.empty) {
        console.log(`No future games found for repeater ${repeaterRef.id}. Skipping...`);
        continue;
      }

      // Group games by date
      const gamesByDate = {};
      gamesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const dateStr = data.date.toDate().toISOString().split('T')[0];

        if (!gamesByDate[dateStr]) {
          gamesByDate[dateStr] = [];
        }
        gamesByDate[dateStr].push({ id: doc.id, ref: doc.ref, attendees: data.attendees || [] });
      });

      for (const [date, games] of Object.entries(gamesByDate)) {
        console.log(`\nProcessing games on date: ${date}`);

        if (games.length <= 1) {
          console.log('Only one game found for this date. No action needed.');
          continue;
        }

        // Find the game to keep (with attendees)
        const gameToKeep = games.find(game => game.attendees.length > 0) || games[0];
        console.log(`Keeping game: ${gameToKeep.id}`);

        // Delete other games
        const gamesToDelete = games.filter(game => game.id !== gameToKeep.id);
        for (const game of gamesToDelete) {
          console.log(`Deleting game: ${game.id}`);
          await deleteGameAndInvitations(game.ref);
        }
      }
    }

    console.log('Cleanup process completed successfully.');
  } catch (error) {
    console.error('Error during cleanup process:', error);
  }
}

async function deleteGameAndInvitations(gameRef) {
  try {
    // Delete game invitations related to this game
    const invitationsSnapshot = await db.collection('game_invitations')
      .where('game', '==', gameRef)
      .get();

    if (!invitationsSnapshot.empty) {
      console.log(`Found ${invitationsSnapshot.size} invitations to delete for game ${gameRef.id}.`);
      const batch = db.batch();
      invitationsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      console.log(`Deleted all invitations for game ${gameRef.id}.`);
    } else {
      console.log(`No invitations found for game ${gameRef.id}.`);
    }

    // Delete the game itself
    await gameRef.delete();
    console.log(`Game ${gameRef.id} deleted successfully.`);
  } catch (error) {
    console.error(`Error deleting game ${gameRef.id}:`, error);
  }
}

cleanUpRepeaters();
