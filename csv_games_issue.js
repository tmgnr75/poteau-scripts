const admin = require('firebase-admin');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const TARGET_DATE = '2024-12-14'; // Date for filtering games
const HOUR_WINDOW = 4; // Hours before and after

(async function generateCSV() {
    console.log(`[INFO] Starting CSV generation for games on ${TARGET_DATE}`);

    try {
        const targetStart = new Date(`${TARGET_DATE}T00:00:00Z`);
        const queryStart = new Date(targetStart);
        queryStart.setHours(queryStart.getHours() - HOUR_WINDOW);

        const queryEnd = new Date(targetStart);
        queryEnd.setHours(queryEnd.getHours() + 24 + HOUR_WINDOW);

        console.log(`[INFO] Querying games between ${queryStart.toISOString()} and ${queryEnd.toISOString()}`);

        const gamesSnapshot = await db.collection('games')
            .where('date', '>=', queryStart)
            .where('date', '<=', queryEnd)
            .get();

        if (gamesSnapshot.empty) {
            console.log(`[INFO] No games found within the specified time window.`);
            return;
        }

        console.log(`[INFO] Found ${gamesSnapshot.size} game(s). Processing...`);

        const gamesData = [];
        gamesSnapshot.forEach((doc) => {
            const data = doc.data();
            gamesData.push({
                id: doc.id,
                date: data.scheduled_date ? data.scheduled_date.toDate().toISOString() : '', // Convert Firestore Timestamp to ISO string
                location: data.location ? `${data.location.latitude},${data.location.longitude}` : '' // Convert LatLng to string
            });
        });

        console.log(`[INFO] Preparing CSV...`);

        const csvWriter = createCsvWriter({
            path: `games_${TARGET_DATE}.csv`,
            header: [
                { id: 'id', title: 'ID' },
                { id: 'date', title: 'Date' },
                { id: 'location', title: 'Location' }
            ]
        });

        await csvWriter.writeRecords(gamesData);
        console.log(`[SUCCESS] CSV file generated: games_${TARGET_DATE}.csv`);
    } catch (error) {
        console.error(`[ERROR] Failed to generate CSV:`, error);
    }
})();