const admin = require('firebase-admin');
const axios = require('axios');
const { Timestamp } = require('firebase-admin/firestore');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const API_KEY = 'bdc_4208977656e04b8fae4d844781b01e51';
const GAMES_COLLECTION = 'games';
const START_DATE = new Date('2025-05-12T00:00:00Z');

(async () => {
  console.log('Starting country_code backfill for games after 2025-05-12');

  let found = 0;
  let updated = 0;
  let skipped = 0;
  let errored = 0;

  try {
    const snapshot = await db.collection(GAMES_COLLECTION)
      .where('date', '>=', Timestamp.fromDate(START_DATE))
      .get();

    found = snapshot.size;
    console.log(`Found ${found} games to inspect`);

    for (const doc of snapshot.docs) {
      const gameData = doc.data();
      const gameId = doc.id;

      if (gameData.country_code) {
        console.log(`[SKIP] Game ${gameId} already has country_code: ${gameData.country_code}`);
        skipped++;
        continue;
      }

      if (!gameData.location || !gameData.location.latitude || !gameData.location.longitude) {
        console.log(`[SKIP] Game ${gameId} has no valid location data`);
        skipped++;
        continue;
      }

      const { latitude, longitude } = gameData.location;
      console.log(`[PROCESS] Game ${gameId} - Fetching country code for lat: ${latitude}, lng: ${longitude}`);

      try {
        const geoResponse = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode`, {
          params: {
            latitude,
            longitude,
            localityLanguage: 'en',
            key: API_KEY,
          }
        });

        const countryCode = geoResponse.data.countryCode;

        if (!countryCode) {
          console.warn(`[WARNING] Game ${gameId} - No country code found`);
          skipped++;
          continue;
        }

        await doc.ref.update({ country_code: countryCode });
        console.log(`[UPDATED] Game ${gameId} - country_code set to ${countryCode}`);
        updated++;

      } catch (err) {
        console.error(`[ERROR] Failed to fetch or update country code for Game ${gameId}`, err.message);
        errored++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`Total games found:   ${found}`);
    console.log(`Games updated:       ${updated}`);
    console.log(`Games skipped:       ${skipped}`);
    console.log(`Errors encountered:  ${errored}`);
    console.log('Backfill operation completed.\n');

  } catch (err) {
    console.error('Failed to query games or initialize operation', err.message);
  }
})();