const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

async function countUniqueCombinations() {
    console.log('Fetching all alerts...');
    const snapshot = await db.collection('alerts').get();
    console.log(`Total alerts: ${snapshot.size}`);

    const uniqueCombos = new Set();
    let totalPlaceCombinations = 0;
    let alertsWithNoPlaces = 0;
    let alertsWithNoUser = 0;

    snapshot.forEach(doc => {
        const data = doc.data();
        const userId = data.user ? data.user.id : null;
        const places = data.places || [];

        if (!userId) {
            alertsWithNoUser++;
            return;
        }

        if (places.length === 0) {
            alertsWithNoPlaces++;
            return;
        }

        places.forEach(place => {
            const placeId = place.placeId || place.place_id;
            if (placeId) {
                totalPlaceCombinations++;
                uniqueCombos.add(`${userId}_${placeId}`);
            }
        });
    });

    console.log('\n=== RESULTS ===');
    console.log(`Total alerts documents: ${snapshot.size}`);
    console.log(`Alerts with no user ref: ${alertsWithNoUser}`);
    console.log(`Alerts with no places: ${alertsWithNoPlaces}`);
    console.log(`Total (alert × place) combinations: ${totalPlaceCombinations}`);
    console.log(`Unique (userId, placeId) combinations: ${uniqueCombos.size}`);
    console.log(`\nThis means ${uniqueCombos.size} availability documents after merging.`);
    console.log(`Compression ratio: ${(totalPlaceCombinations / uniqueCombos.size).toFixed(1)}x`);

    process.exit(0);
}

countUniqueCombinations().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
