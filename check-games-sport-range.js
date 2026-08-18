const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function checkGamesSportInRange() {
  try {
    console.log('Checking games sport field in date range...\n');

    const now = new Date();

    // Calculate dates
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    console.log(`Start date: ${sevenDaysAgo.toISOString()}`);
    console.log(`End date: ${threeDaysFromNow.toISOString()}\n`);

    // Convert to Firestore Timestamps
    const startTimestamp = admin.firestore.Timestamp.fromDate(sevenDaysAgo);
    const endTimestamp = admin.firestore.Timestamp.fromDate(threeDaysFromNow);

    // Get games in the date range
    const gamesSnapshot = await db.collection('games')
      .where('date', '>=', startTimestamp)
      .where('date', '<=', endTimestamp)
      .get();

    console.log(`Total games in range: ${gamesSnapshot.size}\n`);

    let withSportCount = 0;
    let noSportCount = 0;
    const sportCounts = {};

    gamesSnapshot.forEach(doc => {
      const data = doc.data();
      const sport = data.sport;

      if (!sport || sport === '') {
        noSportCount++;
      } else {
        withSportCount++;
        sportCounts[sport] = (sportCounts[sport] || 0) + 1;
      }
    });

    console.log(`Games WITH "sport" field: ${withSportCount}`);
    console.log(`Games WITHOUT "sport" field: ${noSportCount}`);
    console.log(`Percentage with sport: ${gamesSnapshot.size > 0 ? ((withSportCount / gamesSnapshot.size) * 100).toFixed(2) : 0}%\n`);

    if (Object.keys(sportCounts).length > 0) {
      console.log('Games grouped by sport value:');

      // Sort by count descending
      const sortedSports = Object.entries(sportCounts)
        .sort(([, a], [, b]) => b - a);

      sortedSports.forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count}`);
      });
    }

    console.log('\nDone!');

  } catch (error) {
    console.error('Error checking games:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

checkGamesSportInRange();
