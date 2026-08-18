// Publish Todd's Saturday + Sunday games for May 2026.
// Dry-run by default. Pass --apply to actually write.
//
// Saturday template: Randy Johnson Park Bluff Creek Fields, 10:30 AM PT, 90 min, 18 players.
// Sunday template:   The Sports Park, 6:00 PM PT, 105 min, 22 players.
// Both: $25 USD, on-site, soccer captain-mode, chill, public, gold not exclusive.
// Field shape mirrors Todd's most recent published games (e.g. hchGgeiOVn1ldLyoYYE3, qvXN9GaKH3coeAqZhHPN).

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();
const { GeoPoint, Timestamp, FieldValue } = admin.firestore;

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TODD_REF = db.collection('users').doc(TODD_UID);

const APPLY = process.argv.includes('--apply');

const SATURDAY_TEMPLATE = {
  centre: 'Randy Johnson Park Bluff Creek Fields',
  place_id: 'ChIJmzdpxaKwwoARSE3B2r7v5EA',
  address: 'Los Angeles',
  location: new GeoPoint(33.974743, -118.4143507),
  max_players: 18,
  duration: 90, // 10:30 AM -> 12:00 PM
  startHourPT: 10,
  startMinutePT: 30,
};

const SUNDAY_TEMPLATE = {
  centre: 'The Sports Park',
  place_id: 'ChIJPZi5ppGwwoARjRzePFD-SfQ',
  address: '13196 Bluff Creek Dr, Los Angeles',
  location: new GeoPoint(33.9671522, -118.4263166),
  max_players: 22,
  duration: 105, // 6:00 PM -> 7:45 PM
  startHourPT: 18,
  startMinutePT: 0,
};

// Build a UTC Date for a given LA local date+time. May is PDT = UTC-7.
// We pick PDT because all four Saturdays and Sundays fall in PDT (DST runs
// 2026-03-08 through 2026-11-01).
const PDT_OFFSET_HOURS = 7;
function laDateToUTC(year, month1to12, day, localHour, localMinute) {
  return new Date(Date.UTC(year, month1to12 - 1, day, localHour + PDT_OFFSET_HOURS, localMinute, 0));
}

function buildGameData(template, year, month1to12, day) {
  const startUTC = laDateToUTC(year, month1to12, day, template.startHourPT, template.startMinutePT);
  const endUTC = new Date(startUTC.getTime() + template.duration * 60 * 1000);
  return {
    address: template.address,
    date: Timestamp.fromDate(startUTC),
    duration: template.duration,
    location: template.location,
    max_players: template.max_players,
    reservation_name: 'Todd Elliot',
    mood: 'chill',
    organizer: TODD_UID,
    centre: template.centre,
    end_time: Timestamp.fromDate(endUTC),
    type: 'captain',
    price: 25,
    visibility: 'public',
    place_id: template.place_id,
    currency: 'USD',
    players_to_find: template.max_players - 1, // Todd takes 1 spot
    sport: 'soccer',
    payment_type: 'on-site',
    time_zone: 'America/Los_Angeles',
    country_code: 'US',
    level_deltas: ['three_four', 'five_six', 'seven_eight'],
    status: 'published',
    gold_exclusive: false,
    created_on: FieldValue.serverTimestamp(),
    interested: [],
    attendees: [TODD_REF],
    // teams will be initialized by the initGameTeams onCreate trigger using `attendees`.
    // slot_key / currency / time_zone will additionally be (re-)set by addCurrencyPlusTimezone.
  };
}

const PLAN = [
  // Saturdays
  { template: SATURDAY_TEMPLATE, label: 'Sat 2026-05-09 10:30 AM PT', y: 2026, m: 5, d: 9 },
  { template: SATURDAY_TEMPLATE, label: 'Sat 2026-05-16 10:30 AM PT', y: 2026, m: 5, d: 16 },
  { template: SATURDAY_TEMPLATE, label: 'Sat 2026-05-23 10:30 AM PT', y: 2026, m: 5, d: 23 },
  { template: SATURDAY_TEMPLATE, label: 'Sat 2026-05-30 10:30 AM PT', y: 2026, m: 5, d: 30 },
  // Sundays
  { template: SUNDAY_TEMPLATE, label: 'Sun 2026-05-10 6:00 PM PT', y: 2026, m: 5, d: 10 },
  { template: SUNDAY_TEMPLATE, label: 'Sun 2026-05-17 6:00 PM PT', y: 2026, m: 5, d: 17 },
  { template: SUNDAY_TEMPLATE, label: 'Sun 2026-05-24 6:00 PM PT', y: 2026, m: 5, d: 24 },
  { template: SUNDAY_TEMPLATE, label: 'Sun 2026-05-31 6:00 PM PT', y: 2026, m: 5, d: 31 },
];

async function main() {
  console.log(APPLY ? '=== APPLY MODE — WRITING ===' : '=== DRY RUN — no writes ===');
  console.log('');

  // Safety: prevent duplicate publishes if run twice.
  // Look up published Todd games on these exact dates.
  const dupChecks = [];
  for (const p of PLAN) {
    const startUTC = laDateToUTC(p.y, p.m, p.d, p.template.startHourPT, p.template.startMinutePT);
    dupChecks.push({ p, startUTC });
  }
  // Query window: from earliest start - 1h to latest start + 1h.
  const minDate = new Date(Math.min(...dupChecks.map((c) => c.startUTC.getTime())) - 3600000);
  const maxDate = new Date(Math.max(...dupChecks.map((c) => c.startUTC.getTime())) + 3600000);
  const existingSnap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .where('date', '>=', Timestamp.fromDate(minDate))
    .where('date', '<=', Timestamp.fromDate(maxDate))
    .get();
  const existingByMs = new Map();
  existingSnap.docs.forEach((d) => {
    const data = d.data();
    if (data.status === 'published' || data.status === 'played') {
      existingByMs.set(data.date.toDate().getTime(), { id: d.id, ...data });
    }
  });

  let wouldCreate = 0;
  let skipped = 0;

  for (const { p, startUTC } of dupChecks) {
    const conflict = existingByMs.get(startUTC.getTime());
    if (conflict) {
      console.log(`SKIP  ${p.label}  -> already exists: ${conflict.id} (status=${conflict.status})`);
      skipped++;
      continue;
    }

    const gameData = buildGameData(p.template, p.y, p.m, p.d);
    console.log(`PLAN  ${p.label}`);
    console.log(`        centre="${gameData.centre}"  max_players=${gameData.max_players}  duration=${gameData.duration}`);
    console.log(`        date(UTC)=${gameData.date.toDate().toISOString()}  end(UTC)=${gameData.end_time.toDate().toISOString()}`);

    if (APPLY) {
      const docRef = await db.collection('games').add(gameData);
      console.log(`        CREATED games/${docRef.id}`);
    }
    wouldCreate++;
  }

  console.log('');
  console.log(`Summary: ${wouldCreate} would create, ${skipped} skipped (duplicates).`);
  if (!APPLY) {
    console.log('Dry run only — pass --apply to write.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
