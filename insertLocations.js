const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Input data
const locations = [
    {
        "CENTRE": "Athletic Arena",
        "PLACE_ID": "ChIJOXE_fJ9N8kcRnbiR9pBVDdY"
    }
];

async function insertLocations() {
    console.log(`🚀 Starting insertion of ${locations.length} locations into Firestore...`);

    for (const loc of locations) {
        const { PLACE_ID, CENTRE } = loc;
        const docRef = db.collection('location_pictures').doc(PLACE_ID);

        try {
            console.log(`📌 Preparing to insert document for PLACE_ID: ${PLACE_ID} (${CENTRE})...`);

            await docRef.set({
                pictures: [],
                location_name: CENTRE,
            });

            console.log(`✅ Successfully inserted document: ${PLACE_ID}`);
        } catch (error) {
            console.error(`❌ Failed to insert document for PLACE_ID: ${PLACE_ID}`, error);
        }
    }

    console.log(`🎉 All insertions attempted. Script finished.`);
}

insertLocations();