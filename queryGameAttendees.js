const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// List of game document IDs to query
const gameIds = [
  'dER1Vj3NaObJb4c3BE9y',
  'OXUJAFdycloTIwnNADRE',
  'qqAtjaeycHVlj071jcAN',
  'G1f29JjZyJyZdWoLaU4B',
  '6LQ036McMLpYYXYMLXEH',
  '8IHa6vRgsfNgv60AeKYe',
  'Dfcx1lsL1eNWGW5bnh2f',
  'Mnme6dfKP7z4QrFvAzao',
  '2YdWXR1ZJX7MuTbQPo8g',
  'mnfFFIv0n7CPD7a7SspU'
];

async function queryGameAttendees() {
  console.log('='.repeat(80));
  console.log('Starting query for game attendees');
  console.log(`Total games to process: ${gameIds.length}`);
  console.log('='.repeat(80));
  console.log('');

  // Set to store unique user document references
  const uniqueUserPaths = new Set();
  const gameAttendeesMap = new Map();

  let processedGames = 0;
  let gamesWithAttendees = 0;
  let gamesWithoutAttendees = 0;
  let totalAttendeesCount = 0;

  // Process each game document
  for (const gameId of gameIds) {
    processedGames++;
    console.log(`[${processedGames}/${gameIds.length}] Processing game: ${gameId}`);

    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        console.log(`  ⚠️  Game document does not exist`);
        console.log('');
        continue;
      }

      const gameData = gameDoc.data();
      console.log(`  ✓ Game document found`);

      // Check if attendees field exists and is an array
      if (!gameData.attendees) {
        console.log(`  ⚠️  No 'attendees' field found in game document`);
        gamesWithoutAttendees++;
        console.log('');
        continue;
      }

      if (!Array.isArray(gameData.attendees)) {
        console.log(`  ⚠️  'attendees' field is not an array (type: ${typeof gameData.attendees})`);
        gamesWithoutAttendees++;
        console.log('');
        continue;
      }

      const attendeesCount = gameData.attendees.length;
      console.log(`  → Found ${attendeesCount} attendee(s) in this game`);

      if (attendeesCount === 0) {
        console.log(`  ℹ️  Attendees array is empty`);
        gamesWithoutAttendees++;
        console.log('');
        continue;
      }

      gamesWithAttendees++;
      totalAttendeesCount += attendeesCount;

      // Store attendees for this game
      const gameAttendees = [];

      // Process each attendee reference
      gameData.attendees.forEach((attendeeRef, index) => {
        // Check if it's a DocumentReference
        if (attendeeRef && typeof attendeeRef.path === 'string') {
          const userPath = attendeeRef.path;
          gameAttendees.push(userPath);
          uniqueUserPaths.add(userPath);
          console.log(`    [${index + 1}] ${userPath}`);
        } else {
          console.log(`    [${index + 1}] ⚠️  Invalid reference (not a DocumentReference)`);
        }
      });

      gameAttendeesMap.set(gameId, gameAttendees);
      console.log('');

    } catch (error) {
      console.error(`  ❌ Error processing game ${gameId}:`, error.message);
      console.log('');
    }
  }

  // Print summary
  console.log('='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total games processed: ${processedGames}`);
  console.log(`Games with attendees: ${gamesWithAttendees}`);
  console.log(`Games without attendees: ${gamesWithoutAttendees}`);
  console.log(`Total attendees across all games: ${totalAttendeesCount}`);
  console.log(`Unique users found: ${uniqueUserPaths.size}`);
  console.log('');

  // Print all unique user paths
  console.log('='.repeat(80));
  console.log('UNIQUE USERS (sorted alphabetically)');
  console.log('='.repeat(80));
  const sortedUserPaths = Array.from(uniqueUserPaths).sort();
  sortedUserPaths.forEach((userPath, index) => {
    console.log(`${index + 1}. ${userPath}`);
  });
  console.log('');

  // Print game-by-game breakdown
  console.log('='.repeat(80));
  console.log('GAME-BY-GAME BREAKDOWN');
  console.log('='.repeat(80));
  gameAttendeesMap.forEach((attendees, gameId) => {
    console.log(`\nGame: /games/${gameId}`);
    console.log(`Attendees count: ${attendees.length}`);
    attendees.forEach((userPath, index) => {
      console.log(`  ${index + 1}. ${userPath}`);
    });
  });
  console.log('');

  console.log('='.repeat(80));
  console.log('Query completed successfully');
  console.log('='.repeat(80));

  return {
    uniqueUsers: sortedUserPaths,
    totalGames: processedGames,
    gamesWithAttendees,
    gamesWithoutAttendees,
    totalAttendeesCount,
    uniqueUserCount: uniqueUserPaths.size,
    gameAttendeesMap: Object.fromEntries(gameAttendeesMap)
  };
}

// Run the query
queryGameAttendees()
  .then((result) => {
    console.log('\n✓ Script execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script execution failed:', error);
    process.exit(1);
  });
