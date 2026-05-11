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

// Billing window (LA local time, end-exclusive)
const BILLING_START = new Date('2026-04-01T00:00:00-07:00'); // PDT
const BILLING_END = new Date('2026-05-01T00:00:00-07:00');

// Wider visibility window so we can sanity-check edge cases
const PEEK_START = new Date('2026-03-15T00:00:00-07:00');
const PEEK_END = new Date('2026-05-07T23:59:59-07:00');

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
  // Pull EVERY played game by Todd chronologically so the "first match ever"
  // detection accounts for games played before April.
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .where('status', '==', 'played')
    .orderBy('date', 'asc')
    .get();

  if (snap.empty) {
    console.log(`No played games found for ${TODD_NAME}.`);
    return;
  }

  console.log(`Found ${snap.size} played games for ${TODD_NAME} in total.\n`);

  const playersWhoHavePlayed = new Set();
  const peekRows = [];
  const billedRows = [];
  let totalOwed = 0;
  let totalNew = 0;
  let totalReturning = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
    const sport = d.sport || '?';
    const centre = d.centre || '';
    const playerIds = extractPlayerIds(d.attendees);

    let cost = 0;
    let firstTimers = 0;
    let returners = 0;
    for (const pid of playerIds) {
      if (playersWhoHavePlayed.has(pid)) {
        cost += RETURNING_RATE;
        returners += 1;
      } else {
        cost += FIRST_MATCH_RATE;
        firstTimers += 1;
      }
      // Mark AFTER decision so within-this-game duplicates already filtered by Set above.
      playersWhoHavePlayed.add(pid);
    }

    const inBilling = date >= BILLING_START && date < BILLING_END;
    const inPeek = date >= PEEK_START && date <= PEEK_END;

    if (inPeek) {
      peekRows.push({
        id: doc.id,
        date,
        sport,
        centre,
        players: playerIds.length,
        firstTimers,
        returners,
        cost,
        billed: inBilling,
      });
    }

    if (inBilling) {
      billedRows.push({ id: doc.id, date, sport, centre, players: playerIds.length, firstTimers, returners, cost });
      totalOwed += cost;
      totalNew += firstTimers;
      totalReturning += returners;
    }
  }

  // Wider peek (March 15 → May 7)
  console.log('='.repeat(110));
  console.log(`${TODD_NAME.toUpperCase()} — GAMES IN PEEK WINDOW (${laDate(PEEK_START)} → ${laDate(PEEK_END)}, ${TZ})`);
  console.log('='.repeat(110));
  console.log(
    'Date (LA)'.padEnd(13) +
      'Time'.padEnd(7) +
      'Sport'.padEnd(10) +
      'Players'.padEnd(9) +
      'New'.padEnd(5) +
      'Ret'.padEnd(5) +
      'Cost'.padEnd(8) +
      'Bill?'.padEnd(7) +
      'Centre / Game ID',
  );
  console.log('-'.repeat(110));
  for (const r of peekRows) {
    console.log(
      laDate(r.date).padEnd(13) +
        laTime(r.date).padEnd(7) +
        String(r.sport).padEnd(10) +
        String(r.players).padEnd(9) +
        String(r.firstTimers).padEnd(5) +
        String(r.returners).padEnd(5) +
        `$${r.cost}`.padEnd(8) +
        (r.billed ? 'YES' : 'no ').padEnd(7) +
        `${r.centre} — ${r.id}`,
    );
  }
  console.log('-'.repeat(110));
  console.log('');

  // Billing summary (April only)
  console.log('='.repeat(110));
  console.log(`${TODD_NAME.toUpperCase()} — APRIL 2026 BILLING (${laDate(BILLING_START)} → ${laDate(new Date(BILLING_END.getTime() - 1))} ${TZ})`);
  console.log('='.repeat(110));
  console.log(`Rates: first match $${FIRST_MATCH_RATE} / returning $${RETURNING_RATE}`);
  console.log(`Games billed: ${billedRows.length}`);
  console.log(`Total first-match player-slots: ${totalNew} × $${FIRST_MATCH_RATE} = $${totalNew * FIRST_MATCH_RATE}`);
  console.log(`Total returning player-slots:   ${totalReturning} × $${RETURNING_RATE} = $${totalReturning * RETURNING_RATE}`);
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
