const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TODD_NAME = 'Todd';
const FIRST_MATCH_RATE = 15;
const RETURNING_RATE = 10;
const TZ = 'America/Los_Angeles';

// Cutoff: end of today in LA (2026-05-11). Games strictly after this are excluded.
const CUTOFF = new Date('2026-05-11T23:59:59-07:00');

const laDate = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const extractPlayerIds = (attendees) =>
  [
    ...new Set(
      (attendees || [])
        .map((a) => {
          if (typeof a === 'string') return a;
          if (a && a.id) return a.id;
          if (a && a.path) return a.path.split('/').pop();
          return null;
        })
        .filter((id) => id && id !== TODD_UID),
    ),
  ];

async function main() {
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .orderBy('date', 'asc')
    .get();

  if (snap.empty) {
    console.log(`No games found for ${TODD_NAME}.`);
    return;
  }

  const uniqueFirstTimers = new Set(); // each player counted once, lifetime
  let totalAttendances = 0;            // sum of all player-slots across all kept games
  let totalNew = 0;                    // first-time slots (== uniqueFirstTimers.size at end)
  let totalReturning = 0;              // returning slots
  let totalCost = 0;
  let gamesKept = 0;
  let firstGameDate = null;
  let lastGameDate = null;

  for (const doc of snap.docs) {
    const d = doc.data();
    const status = d.status || '?';
    if (status === 'canceled' || status === 'hidden') continue;

    const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
    if (date > CUTOFF) continue;
    const playerIds = extractPlayerIds(d.attendees);

    let firstTimers = 0;
    let returners = 0;
    for (const pid of playerIds) {
      if (uniqueFirstTimers.has(pid)) {
        totalReturning += 1;
        returners += 1;
      } else {
        uniqueFirstTimers.add(pid);
        totalNew += 1;
        firstTimers += 1;
      }
    }
    const cost = firstTimers * FIRST_MATCH_RATE + returners * RETURNING_RATE;

    totalAttendances += playerIds.length;
    totalCost += cost;
    gamesKept += 1;
    if (!firstGameDate) firstGameDate = date;
    lastGameDate = date;
  }

  console.log('='.repeat(80));
  console.log(`${TODD_NAME.toUpperCase()} — LIFETIME RECAP`);
  console.log(`Rates: first match $${FIRST_MATCH_RATE} / returning $${RETURNING_RATE}`);
  console.log(`Excludes canceled/hidden. Todd himself never counted as a player.`);
  console.log('='.repeat(80));
  console.log(`Window:                 ${firstGameDate ? laDate(firstGameDate) : '—'} → ${lastGameDate ? laDate(lastGameDate) : '—'}`);
  console.log(`Games counted:          ${gamesKept}`);
  console.log(`Total player-slots:     ${totalAttendances}`);
  console.log(`Unique first-timers:    ${uniqueFirstTimers.size} × $${FIRST_MATCH_RATE} = $${uniqueFirstTimers.size * FIRST_MATCH_RATE}`);
  console.log(`Returning player-slots: ${totalReturning} × $${RETURNING_RATE} = $${totalReturning * RETURNING_RATE}`);
  console.log('');
  console.log(`>>> TOTAL OWED TO ${TODD_NAME.toUpperCase()} LIFETIME: $${totalCost} <<<`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
