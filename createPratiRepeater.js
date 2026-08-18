const admin = require('firebase-admin');
const { Timestamp, GeoPoint } = require('firebase-admin/firestore');
const moment = require('moment-timezone');

// Initialize Firebase Admin SDK
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function createRepeater() {
  console.log("🔵 Initializing Firestore operation...");

  try {
    // Get tomorrow's date at 7:00 PM in Europe/Paris timezone
    const timeZone = "Europe/Paris";
    const tomorrow = moment().tz(timeZone).add(1, 'day').set({ hour: 19, minute: 0, second: 0, millisecond: 0 });
    const timestamp = Timestamp.fromDate(tomorrow.toDate());

    console.log(`📌 Computed 'firstOccurrence' & 'time' as: ${tomorrow.format()} (Unix: ${timestamp.toMillis()})`);

    // Define the document data
    const repeaterData = {
      address: "Prati = Best neighbourhood in Rome",
      centre: "Prati United",
      duration: 60,
      expectedTime: "19:00",
      firstOccurrence: timestamp,
      location: new GeoPoint(41.915711, 12.463407),
      maxPlayers: 10,
      organizer: "zCvsukfMuuffsuPpSTQwb7MusMD2",
      placeId: "PratiUnited",
      price: 8,
      status: "published",
      time: timestamp,
      timeZone: timeZone,
      weekday: 5, // Monday = 1, Tuesday = 2, etc.
      paymentType: "in-app",
    };

    console.log("📝 Prepared repeater document data:", repeaterData);

    // Add document to Firestore
    const docRef = await db.collection("repeaters").add(repeaterData);

    console.log(`✅ Successfully created repeater document with ID: ${docRef.id}`);
  } catch (error) {
    console.error("❌ Error creating repeater document:", error);
  }
}

// Execute function
createRepeater();