const admin = require('firebase-admin');
const { DateTime } = require('luxon'); // For timezone-aware datetime handling
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
  console.log('[START] Validating future games against their repeaters config');

  const now = new Date();
  const gamesSnapshot = await db
    .collection('games')
    .where('date', '>', now)
    .get();

  console.log(`[INFO] Retrieved ${gamesSnapshot.size} future games`);

  for (const doc of gamesSnapshot.docs) {
    const game = doc.data();
    const gameId = doc.id;

    if (!game.repeater) {
      console.log(`[SKIP] Game ${gameId} has no 'repeater' field set`);
      continue;
    }

    const repeaterRef = game.repeater;
    const repeaterSnap = await repeaterRef.get();

    if (!repeaterSnap.exists) {
      console.warn(`[WARN] Repeater doc not found for Game ${gameId}`);
      continue;
    }

    const repeater = repeaterSnap.data();
    const expectedTimeStr = repeater.expectedTime;
    const timeZone = repeater.timeZone;

    if (!expectedTimeStr || !timeZone) {
      console.warn(`[WARN] Repeater for Game ${gameId} is missing 'expectedTime' or 'timeZone'`);
      continue;
    }

    const [expectedHour, expectedMinute] = expectedTimeStr.split(':').map(Number);
    const gameDate = game.date.toDate();

    const localGameTime = DateTime.fromJSDate(gameDate, { zone: timeZone });

    const gameWeekday = localGameTime.weekday; // Luxon: 1 = Monday, 7 = Sunday

    const expectedDateTime = localGameTime.set({
      hour: expectedHour,
      minute: expectedMinute,
      second: 0,
      millisecond: 0,
    });

    const isTimeCorrect = localGameTime.hour === expectedHour && localGameTime.minute === expectedMinute;
    const isWeekdayCorrect = gameWeekday === expectedDateTime.weekday;

    console.log(`[CHECK] Game ${gameId} — Local Time: ${localGameTime.toFormat('yyyy-MM-dd HH:mm')} (${timeZone})`);
    console.log(`        Expected Time: ${expectedTimeStr}, Expected Weekday: ${expectedDateTime.weekday}`);
    console.log(`        -> Time Match: ${isTimeCorrect}, Weekday Match: ${isWeekdayCorrect}`);

    if (!isTimeCorrect || !isWeekdayCorrect) {
      console.warn(`[MISMATCH] Game ${gameId} does not match repeater settings`);
    }
  }

  console.log('[DONE] Game validation completed.');
})();