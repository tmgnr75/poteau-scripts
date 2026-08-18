const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// CONFIG
const OLD_PLACE_ID = "impulstarpark";
const NEW_PLACE_ID = "ChIJLdkocwBh5kcR14AXaHHKBaw";

async function updateGamesPlaceId() {
    console.log(`[START] Updating games with place_id == "${OLD_PLACE_ID}"`);
    console.log(`[INFO] Target replacement: "${NEW_PLACE_ID}"`);

    try {
        const snapshot = await db.collection('games')
            .where('place_id', '==', OLD_PLACE_ID)
            .get();

        if (snapshot.empty) {
            console.log(`[RESULT] No games found with place_id "${OLD_PLACE_ID}". Nothing to update.`);
            return;
        }

        console.log(`[INFO] Found ${snapshot.size} games with place_id "${OLD_PLACE_ID}"`);

        let successCount = 0;
        let failCount = 0;

        for (const doc of snapshot.docs) {
            const gameId = doc.id;
            const gameData = doc.data();

            console.log(`[PROCESS] Updating game ${gameId} (current place_id: ${gameData.place_id})`);

            try {
                await doc.ref.update({ place_id: NEW_PLACE_ID });
                console.log(`[SUCCESS] Game ${gameId} updated successfully → place_id set to "${NEW_PLACE_ID}"`);
                successCount++;
            } catch (err) {
                console.error(`[ERROR] Failed to update game ${gameId}:`, err.message);
                failCount++;
            }
        }

        console.log(`[COMPLETE] Update finished.`);
        console.log(`[SUMMARY] Total games processed: ${snapshot.size}`);
        console.log(`[SUMMARY] Success: ${successCount}, Failures: ${failCount}`);

    } catch (err) {
        console.error(`[FATAL] Error while querying games:`, err.message);
    }
}

updateGamesPlaceId();