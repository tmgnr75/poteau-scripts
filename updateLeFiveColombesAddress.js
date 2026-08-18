/**
 * Migration script: Update LE FIVE Colombes address
 *
 * Changes address from "6 Rue Gisèle Halimi, 92700 Colombes, France"
 * to "12 Avenue Kléber, 92700 Colombes" across:
 * - User doc (nkME2s5zOrP9Boid6uPgOz1Ssfi1)
 * - Cached centre (ChIJtW2wgSxl5kcRW1N56-y8ETo)
 * - All repeaters for this organizer
 * - All future games for this organizer
 */

const admin = require("firebase-admin");
const serviceAccount = require("../cloud-functions/functions/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const USER_ID = "nkME2s5zOrP9Boid6uPgOz1Ssfi1";
const PLACE_ID = "ChIJtW2wgSxl5kcRW1N56-y8ETo";
const NEW_ADDRESS = "12 Avenue Kléber, 92700 Colombes";
const NEW_LOCATION = new admin.firestore.GeoPoint(48.935088, 2.2559521);

async function migrate() {
  // 1. Update user doc
  console.log("=== Updating user doc ===");
  await db.collection("users").doc(USER_ID).update({
    centre_address: NEW_ADDRESS,
    centre_location: NEW_LOCATION,
  });
  console.log("User doc updated.");

  // 2. Update cached centre
  console.log("\n=== Updating cached centre ===");
  const cachedDoc = await db.collection("cachedCentres").doc(PLACE_ID).get();
  if (cachedDoc.exists) {
    await db.collection("cachedCentres").doc(PLACE_ID).update({
      centre_address: NEW_ADDRESS,
      centre_location: NEW_LOCATION,
    });
    console.log("Cached centre updated.");
  } else {
    console.log("Cached centre doc not found, skipping.");
  }

  // 3. Update all repeaters
  console.log("\n=== Updating repeaters ===");
  const repeaters = await db
    .collection("repeaters")
    .where("organizer", "==", USER_ID)
    .get();
  console.log(`Found ${repeaters.size} repeaters.`);

  const repeaterBatch = db.batch();
  repeaters.forEach((doc) => {
    repeaterBatch.update(doc.ref, {
      address: NEW_ADDRESS,
      location: NEW_LOCATION,
    });
  });
  await repeaterBatch.commit();
  console.log(`${repeaters.size} repeaters updated.`);

  // 4. Update all future games
  console.log("\n=== Updating future games ===");
  const now = new Date();
  const futureGames = await db
    .collection("games")
    .where("organizer", "==", USER_ID)
    .where("date", ">=", now)
    .get();
  console.log(`Found ${futureGames.size} future games.`);

  // Firestore batch limit is 500, split if needed
  const batches = [];
  let batch = db.batch();
  let count = 0;
  futureGames.forEach((doc) => {
    batch.update(doc.ref, {
      address: NEW_ADDRESS,
      location: NEW_LOCATION,
    });
    count++;
    if (count === 500) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  });
  if (count > 0) batches.push(batch);

  for (const b of batches) {
    await b.commit();
  }
  console.log(`${futureGames.size} future games updated.`);

  console.log("\n=== Migration complete ===");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
