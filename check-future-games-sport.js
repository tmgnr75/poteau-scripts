const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function checkFutureGamesSport() {
  try {
    console.log('Checking future games sport field...\n');

    const now = admin.firestore.Timestamp.now();

    // Get all future games
    const gamesSnapshot = await db.collection('games')
      .where('date', '>=', now)
      .get();

    console.log(`Total future games: ${gamesSnapshot.size}\n`);

    let noSportCount = 0;
    const sportCounts = {};

    gamesSnapshot.forEach(doc => {
      const data = doc.data();
      const sport = data.sport;

      if (!sport || sport === '') {
        noSportCount++;
      } else {
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      }
    });

    console.log(`Games with no "sport" field: ${noSportCount}`);
    console.log('\nGames grouped by sport value:');

    // Sort by count descending
    const sortedSports = Object.entries(sportCounts)
      .sort(([, a], [, b]) => b - a);

    sortedSports.forEach(([sport, count]) => {
      console.log(`  ${sport}: ${count}`);
    });

    console.log('\nDone!');

  } catch (error) {
    console.error('Error checking games:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

checkFutureGamesSport();
