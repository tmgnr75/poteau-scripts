const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const API_KEY = 'bdc_df35827b8b1c473da850784142e6e2c0';
const TIMEZONE_API_URL = 'https://api.bigdatacloud.net/data/reverse-geocode';

const START_DATE = new Date('2025-05-06T00:00:00.000Z'); // May 6, 2025 at midnight UTC

(async () => {
  console.log(`🔍 Querying all games created after ${START_DATE.toISOString()} without "time_zone"...`);

  const snapshot = await db.collection('games')
    .where('date', '>', START_DATE)
    .get();

  console.log(`📄 Total games fetched: ${snapshot.size}`);

  let totalMissing = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const gameId = doc.id;

    if (data.time_zone) {
      console.log(`✅ Game ${gameId} already has a time_zone (${data.time_zone}), skipping.`);
      continue;
    }

    const location = data.location;
    if (!location || !location.latitude || !location.longitude) {
      console.warn(`⚠️ Game ${gameId} has no valid location, skipping.`);
      continue;
    }

    const { latitude, longitude } = location;

    try {
      console.log(`🌍 Fetching timezone for game ${gameId} at (${latitude}, ${longitude})...`);
      const res = await axios.get(`${TIMEZONE_API_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en&key=${API_KEY}`);
      const informative = res.data.localityInfo?.informative || [];

      const tzInfo = informative.find(info => info.description === 'time zone');
      const timeZone = tzInfo?.name;

      if (!timeZone) {
        console.warn(`⚠️ No timezone found in response for game ${gameId}.`);
        totalFailed++;
        continue;
      }

      await doc.ref.update({ time_zone: timeZone });
      console.log(`🕒 Game ${gameId} updated with time_zone: ${timeZone}`);
      totalUpdated++;
    } catch (error) {
      console.error(`❌ Error processing game ${gameId}:`, error.message);
      totalFailed++;
    }

    totalMissing++;
  }

  console.log(`\n📊 Done.`);
  console.log(`Games missing time_zone: ${totalMissing}`);
  console.log(`Successfully updated: ${totalUpdated}`);
  console.log(`Failed to update: ${totalFailed}`);
})();