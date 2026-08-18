const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function backfillCreatedTime() {
    console.log(`[START] Backfill script for created_on on games collection.`);
    console.log(`[INFO] Project: ${PROJECT_ID}`);

    try {
        const now = new Date();
        console.log(`[INFO] Current time: ${now.toISOString()}`);

        console.log(`[STEP] Querying all future games where "date" > now...`);
        const snapshot = await db.collection('games')
            .where('date', '>', now)
            .get();

        console.log(`[RESULT] Found ${snapshot.size} future games.`);

        if (snapshot.empty) {
            console.log(`[DONE] No future games found. Exiting.`);
            return;
        }

        let updatedCount = 0;
        let skippedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const gameId = doc.id;

            // Safety: format date
            const gameDate = data.date instanceof admin.firestore.Timestamp
                ? data.date.toDate().toISOString()
                : data.date;

            console.log(`\n[GAME] Processing game ${gameId} | Centre: ${data.centre || 'N/A'} | Date: ${gameDate}`);

            if (data.created_on) {
                console.log(`[SKIP] Game ${gameId} already has created_on: ${data.created_on.toDate().toISOString()}`);
                skippedCount++;
                continue;
            }

            // Add created_on now
            const createdNow = admin.firestore.Timestamp.now();
            await doc.ref.update({ created_on: createdNow });

            console.log(`[UPDATE] Added created_on=${createdNow.toDate().toISOString()} to game ${gameId}`);
            updatedCount++;
        }

        console.log(`\n[SUMMARY] Script finished.`);
        console.log(`[SUMMARY] Total future games: ${snapshot.size}`);
        console.log(`[SUMMARY] Updated: ${updatedCount}`);
        console.log(`[SUMMARY] Skipped (already had created_on): ${skippedCount}`);
        console.log(`[END] Backfill complete ✅`);

    } catch (error) {
        console.error(`[ERROR] Script failed:`, error);
    }
}

backfillCreatedTime();