const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

const ORGANIZER_UID = process.argv[2];
const ORGANIZER_NAME = process.argv[3] || 'Organizer';
const FIRST_MATCH_RATE = 15;
const RETURNING_RATE = 10;

if (!ORGANIZER_UID) {
  console.error('Usage: node todd_report.js <organizerUID> [name]');
  process.exit(1);
}

async function main() {
  const gamesSnap = await db.collection('games')
    .where('organizer', '==', ORGANIZER_UID)
    .where('status', '==', 'played')
    .orderBy('date', 'asc')
    .get();

  if (gamesSnap.empty) {
    console.log(`No played games found for ${ORGANIZER_NAME} (${ORGANIZER_UID}).`);
    return;
  }

  console.log(`Found ${gamesSnap.size} played games for ${ORGANIZER_NAME}.\n`);

  // Track which players have already played (across all games, chronologically)
  const playersWhoHavePlayed = new Set();

  let totalOverall = 0;
  let totalFirstTimers = 0;
  let totalReturning = 0;
  const gameReports = [];

  for (const gameDoc of gamesSnap.docs) {
    const data = gameDoc.data();
    const gameDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
    const sport = data.sport || '?';

    // Get unique attendees, excluding organizer
    const attendees = data.attendees || [];
    const playerIds = [...new Set(
      attendees
        .map(a => {
          if (typeof a === 'string') return a;
          if (a && a.id) return a.id;
          if (a && a.path) return a.path.split('/').pop();
          return null;
        })
        .filter(id => id && id !== ORGANIZER_UID)
    )];

    let gameCost = 0;
    let firstTimers = 0;
    let returners = 0;
    const playerDetails = [];

    for (const playerId of playerIds) {
      if (playersWhoHavePlayed.has(playerId)) {
        // Returning player
        gameCost += RETURNING_RATE;
        returners++;
        playerDetails.push({ id: playerId, type: 'returning', cost: RETURNING_RATE });
      } else {
        // First match ever
        gameCost += FIRST_MATCH_RATE;
        firstTimers++;
        playerDetails.push({ id: playerId, type: 'first_match', cost: FIRST_MATCH_RATE });
      }
      playersWhoHavePlayed.add(playerId);
    }

    totalOverall += gameCost;
    totalFirstTimers += firstTimers;
    totalReturning += returners;

    gameReports.push({
      gameId: gameDoc.id,
      date: gameDate,
      sport,
      playerCount: playerIds.length,
      firstTimers,
      returners,
      cost: gameCost,
    });
  }

  // Print report
  console.log('='.repeat(90));
  console.log(`${ORGANIZER_NAME.toUpperCase()} COMPENSATION REPORT`);
  console.log('='.repeat(90));
  console.log(`Organizer: ${ORGANIZER_NAME} (${ORGANIZER_UID})`);
  console.log(`First match rate: $${FIRST_MATCH_RATE} | Returning rate: $${RETURNING_RATE}`);
  console.log('='.repeat(90));
  console.log('');

  console.log(
    'Date'.padEnd(14) +
    'Sport'.padEnd(12) +
    'Players'.padEnd(10) +
    'New'.padEnd(8) +
    'Return'.padEnd(10) +
    'Cost ($)'.padEnd(12) +
    'Game ID'
  );
  console.log('-'.repeat(90));

  for (const g of gameReports) {
    const dateStr = g.date.toISOString().slice(0, 10);
    console.log(
      dateStr.padEnd(14) +
      g.sport.padEnd(12) +
      String(g.playerCount).padEnd(10) +
      String(g.firstTimers).padEnd(8) +
      String(g.returners).padEnd(10) +
      `$${g.cost}`.padEnd(12) +
      g.gameId
    );
  }

  console.log('-'.repeat(90));
  console.log('');
  console.log(`Total games: ${gameReports.length}`);
  console.log(`Total unique players (excl. organizer): ${playersWhoHavePlayed.size}`);
  console.log(`Total first-timers: ${totalFirstTimers} × $${FIRST_MATCH_RATE} = $${totalFirstTimers * FIRST_MATCH_RATE}`);
  console.log(`Total returning: ${totalReturning} × $${RETURNING_RATE} = $${totalReturning * RETURNING_RATE}`);
  console.log('');
  console.log(`>>> TOTAL OWED TO ${ORGANIZER_NAME.toUpperCase()}: $${totalOverall} <<<`);
  console.log('');
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
