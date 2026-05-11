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

// Billing window: April 1 → April 30 inclusive (LA time)
const BILLING_START = new Date('2026-04-01T00:00:00-07:00');
const BILLING_END = new Date('2026-05-01T00:00:00-07:00'); // end-exclusive

const laDate = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const laTime = (d) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
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
  // Pull ALL Todd games chronologically so "first match ever" detection
  // accounts for everything played before April.
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .orderBy('date', 'asc')
    .get();

  if (snap.empty) {
    console.log(`No games found for ${TODD_NAME}.`);
    return;
  }

  const playersWhoHavePlayed = new Set();
  const billedRows = [];
  let totalOwed = 0;
  let totalNew = 0;
  let totalReturning = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
    const status = d.status || '?';

    // Skip canceled/hidden — only count games that actually happened (played or published & past).
    if (status === 'canceled' || status === 'hidden') continue;

    const playerIds = extractPlayerIds(d.attendees);

    // Decide first-time vs returning BEFORE updating the set
    let cost = 0;
    let firstTimers = 0;
    let returners = 0;
    const newPlayersThisGame = new Set();
    const returningPlayersThisGame = new Set();
    for (const pid of playerIds) {
      if (playersWhoHavePlayed.has(pid)) {
        cost += RETURNING_RATE;
        returners += 1;
        returningPlayersThisGame.add(pid);
      } else {
        cost += FIRST_MATCH_RATE;
        firstTimers += 1;
        newPlayersThisGame.add(pid);
      }
    }
    // Now update the chronological "ever played" set
    for (const pid of playerIds) playersWhoHavePlayed.add(pid);

    const inBilling = date >= BILLING_START && date < BILLING_END;
    if (!inBilling) continue;

    billedRows.push({
      id: doc.id,
      date,
      status,
      sport: d.sport || '?',
      centre: d.centre || '',
      players: playerIds.length,
      firstTimers,
      returners,
      cost,
    });
    totalOwed += cost;
    totalNew += firstTimers;
    totalReturning += returners;
  }

  console.log('='.repeat(120));
  console.log(`${TODD_NAME.toUpperCase()} — APRIL 2026 BILLING (1–30 April incl., ${TZ})`);
  console.log(`Rates: first match $${FIRST_MATCH_RATE} / returning $${RETURNING_RATE}`);
  console.log(`Includes all statuses except canceled/hidden.`);
  console.log('='.repeat(120));
  console.log(
    'Date (LA)'.padEnd(13) +
      'Time'.padEnd(7) +
      'Status'.padEnd(12) +
      'Players'.padEnd(9) +
      'New'.padEnd(5) +
      'Ret'.padEnd(5) +
      'Cost'.padEnd(9) +
      'Centre / Game ID',
  );
  console.log('-'.repeat(120));
  for (const r of billedRows) {
    console.log(
      laDate(r.date).padEnd(13) +
        laTime(r.date).padEnd(7) +
        r.status.padEnd(12) +
        String(r.players).padEnd(9) +
        String(r.firstTimers).padEnd(5) +
        String(r.returners).padEnd(5) +
        (`${r.firstTimers}×$${FIRST_MATCH_RATE}+${r.returners}×$${RETURNING_RATE}=$${r.cost}`).padEnd(9) +
        `   ${r.centre} — ${r.id}`,
    );
  }
  console.log('-'.repeat(120));
  console.log('');
  console.log(`Games billed: ${billedRows.length}`);
  console.log(`First-match player-slots: ${totalNew} × $${FIRST_MATCH_RATE} = $${totalNew * FIRST_MATCH_RATE}`);
  console.log(`Returning player-slots:   ${totalReturning} × $${RETURNING_RATE} = $${totalReturning * RETURNING_RATE}`);
  console.log('');
  console.log(`>>> TOTAL OWED TO ${TODD_NAME.toUpperCase()} FOR APRIL 2026: $${totalOwed} <<<`);
  console.log('');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
