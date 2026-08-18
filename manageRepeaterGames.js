const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const ORGANIZER_ID = 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2'; // Replace with the desired organizer ID

async function manageRepeaterGames() {
  try {
    console.log('Starting script to manage repeater games...');
    console.log(`Querying repeaters where organizer == ${ORGANIZER_ID}...`);

    const repeatersSnapshot = await db
      .collection('repeaters')
      .where('organizer', '==', ORGANIZER_ID)
      .get();

    if (repeatersSnapshot.empty) {
      console.log('No repeaters found for the specified organizer.');
      return;
    }

    console.log(`Found ${repeatersSnapshot.size} repeaters. Processing...`);

    for (const repeaterDoc of repeatersSnapshot.docs) {
      const repeaterRef = repeaterDoc.ref;
      console.log(`Processing repeater: ${repeaterRef.path}`);

      const futureGamesSnapshot = await db
        .collection('games')
        .where('repeater', '==', repeaterRef)
        .where('date', '>', new Date())
        .orderBy('date')
        .get();

      if (futureGamesSnapshot.empty) {
        console.log(`No future games found for repeater: ${repeaterRef.path}`);
        continue;
      }

      console.log(`Found ${futureGamesSnapshot.size} future games for repeater: ${repeaterRef.path}`);

      // Group games by week
      const gamesByWeek = {};

      for (const gameDoc of futureGamesSnapshot.docs) {
        const gameData = gameDoc.data();
        const gameDate = new Date(gameData.date.toDate()); // Assuming 'date' is a Firestore Timestamp
        const weekKey = `${gameDate.getFullYear()}-${Math.ceil(
          (gameDate.getDate() + 6 - gameDate.getDay()) / 7
        )}`;

        if (!gamesByWeek[weekKey]) {
          gamesByWeek[weekKey] = [];
        }
        gamesByWeek[weekKey].push(gameDoc);
      }

      // Process games by week
      for (const [weekKey, games] of Object.entries(gamesByWeek)) {
        console.log(`Processing week: ${weekKey} with ${games.length} games.`);

        if (games.length > 1) {
          console.log(
            `Found more than 1 game (${games.length}) for week: ${weekKey}. Deleting extra games...`
          );

          // Sort games by date and keep the earliest one
          games.sort((a, b) => a.data().date.toDate() - b.data().date.toDate());

          const gamesToDelete = games.slice(1); // All but the first one
          for (const gameToDelete of gamesToDelete) {
            console.log(`Deleting game: ${gameToDelete.ref.path}`);
            await gameToDelete.ref.delete();
          }

          console.log(`Deleted ${gamesToDelete.length} extra games for week: ${weekKey}.`);
        } else {
          console.log(`Only 1 game found for week: ${weekKey}. No deletion needed.`);
        }
      }
    }

    console.log('Finished processing all repeaters.');
  } catch (error) {
    console.error('An error occurred while managing repeater games:', error);
  }
}

manageRepeaterGames();