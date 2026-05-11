const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';

// Look at everything from April 1 to May 11 (today), excluding `played`
const WINDOW_START = new Date('2026-04-01T00:00:00-07:00');
const WINDOW_END = new Date('2026-05-11T23:59:59-07:00');

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
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .orderBy('date', 'asc')
    .get();

  if (snap.empty) {
    console.log('No games found.');
    return;
  }

  const rows = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
    if (date < WINDOW_START || date > WINDOW_END) continue;
    if (d.status === 'played') continue; // we want non-played
    rows.push({
      id: doc.id,
      date,
      status: d.status || '?',
      sport: d.sport || '?',
      centre: d.centre || '',
      attendees: extractPlayerIds(d.attendees).length,
      maxPlayers: d.max_players ?? '?',
      interested: (d.interested || []).length,
    });
  }

  console.log(`Found ${rows.length} non-"played" Todd games between ${laDate(WINDOW_START)} and ${laDate(WINDOW_END)} (${TZ}).\n`);

  if (rows.length === 0) {
    console.log('(none)');
    return;
  }

  console.log(
    'Date (LA)'.padEnd(13) +
      'Time'.padEnd(7) +
      'Status'.padEnd(12) +
      'Sport'.padEnd(10) +
      'Att'.padEnd(5) +
      'Max'.padEnd(5) +
      'Int'.padEnd(5) +
      'Centre / Game ID',
  );
  console.log('-'.repeat(110));
  for (const r of rows) {
    console.log(
      laDate(r.date).padEnd(13) +
        laTime(r.date).padEnd(7) +
        r.status.padEnd(12) +
        r.sport.padEnd(10) +
        String(r.attendees).padEnd(5) +
        String(r.maxPlayers).padEnd(5) +
        String(r.interested).padEnd(5) +
        `${r.centre} — ${r.id}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
