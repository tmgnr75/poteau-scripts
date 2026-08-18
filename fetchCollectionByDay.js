const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { format, addDays, startOfDay } = require('date-fns');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const COLLECTIONS = [
  { name: 'game_invitations', dateField: 'created' },
  { name: 'connect', dateField: 'datetime' },
  { name: 'games', dateField: 'date' },
];

const OUTPUT_CSV = path.join(__dirname, 'daily_firestore_stats.csv');
const DATE_FORMAT = 'yyyy-MM-dd';
const DAYS_BACK = 30;

const now = startOfDay(new Date());

function getDayRange(dayOffset) {
  const from = addDays(now, -dayOffset);
  const to = addDays(from, 1);
  return {
    dateStr: format(from, DATE_FORMAT),
    from: admin.firestore.Timestamp.fromDate(from),
    to: admin.firestore.Timestamp.fromDate(to),
  };
}

async function countDocsOnDay(collection, dateField, fromTS, toTS) {
  const snapshot = await db
    .collection(collection)
    .where(dateField, '>=', fromTS)
    .where(dateField, '<', toTS)
    .count()
    .get();

  return snapshot.data().count;
}

async function collectDailyCounts() {
  const resultByDay = {};

  for (let i = DAYS_BACK; i >= 0; i--) {
    const { dateStr, from, to } = getDayRange(i);
    console.log(`📅 ${dateStr}`);

    resultByDay[dateStr] = {};

    for (const { name, dateField } of COLLECTIONS) {
      try {
        const count = await countDocsOnDay(name, dateField, from, to);
        resultByDay[dateStr][name] = count;
        console.log(`   📘 ${name}: ${count}`);
      } catch (err) {
        console.error(`   ❌ Error querying ${name} on ${dateStr}:`, err.message);
        resultByDay[dateStr][name] = -1;
      }
    }
  }

  return resultByDay;
}

function writeCSV(resultByDay) {
  const header = ['date', 'game_invitations', 'connect', 'games'];
  const lines = [header.join(',')];

  for (const [date, counts] of Object.entries(resultByDay)) {
    lines.push([
      date,
      counts['game_invitations'] ?? 0,
      counts['connect'] ?? 0,
      counts['games'] ?? 0,
    ].join(','));
  }

  fs.writeFileSync(OUTPUT_CSV, lines.join('\n'));
  console.log(`\n✅ CSV saved to: ${OUTPUT_CSV}`);
}

(async () => {
  try {
    console.log('🚀 Starting efficient Firestore export (1 query per day per collection)...\n');

    const resultByDay = await collectDailyCounts();
    writeCSV(resultByDay);

    console.log('\n🎉 Done. No wasted reads. Massive collections handled smartly.');
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
})();