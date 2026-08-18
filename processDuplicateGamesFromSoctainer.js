const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const organizerId = "JfJC0qd2OvO5Lb10A6Ia4SuKmAa2";
const deletedGames = [];

async function processGames() {
  try {
    console.log("Fetching future games for organizer:", organizerId);
    const now = new Date();
    const gamesSnapshot = await db.collection('games')
      .where('organizer', '==', organizerId)
      .where('date', '>', now)
      .get();

    if (gamesSnapshot.empty) {
      console.log("No future games found.");
      return;
    }

    const games = gamesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`Fetched ${games.length} games.`);

    // Step 1: Delete games with status "canceled" or "hidden"
    const validGames = [];
    for (const game of games) {
      if (game.status === "canceled" || game.status === "hidden") {
        console.log(`Deleting game: ${game.id} (Status: ${game.status})`);
        await db.collection('games').doc(game.id).delete();
        deletedGames.push(game.id);
      } else {
        validGames.push(game);
      }
    }
    console.log(`Deleted ${deletedGames.length} games. Remaining: ${validGames.length}`);

    // Step 2: Handle games with the same "repeater"
    const repeaterMap = new Map();
    const gamesToDelete = [];
    for (const game of validGames) {
      if (!game.repeater) continue; // Skip games without repeater

      if (!repeaterMap.has(game.repeater.id)) {
        repeaterMap.set(game.repeater.id, []);
      }
      repeaterMap.get(game.repeater.id).push(game);
    }

    console.log(`Found ${repeaterMap.size} repeater groups.`);
    for (const [repeaterId, gameList] of repeaterMap) {
      console.log(`Processing repeater group: ${repeaterId} with ${gameList.length} games.`);

      let gameToKeep = gameList.find(g => g.attendees && g.attendees.length > 0) || gameList[0];
      const duplicateGames = gameList.filter(g => g.id !== gameToKeep.id);
      gamesToDelete.push(...duplicateGames.map(g => g.id));

      for (const game of duplicateGames) {
        console.log(`Deleting duplicate game: ${game.id} under repeater: ${repeaterId}`);
        await db.collection('games').doc(game.id).delete();
      }
    }

    // Step 3: Delete associated "game_invitations" for deleted games
    const allDeletedGames = [...deletedGames, ...gamesToDelete];
    for (const gameId of allDeletedGames) {
      console.log(`Checking game_invitations for deleted game: ${gameId}`);
      const invitationsSnapshot = await db.collection('game_invitations')
        .where('game', '==', db.doc(`games/${gameId}`))
        .get();
      
      for (const invitationDoc of invitationsSnapshot.docs) {
        console.log(`Deleting game_invitation: ${invitationDoc.id} for game: ${gameId}`);
        await db.collection('game_invitations').doc(invitationDoc.id).delete();
      }
    }
    console.log("Processing completed successfully.");
  } catch (error) {
    console.error("Error processing games:", error);
  }
}

processGames();