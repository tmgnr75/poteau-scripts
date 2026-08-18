const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
    console.log("=== Start cleanup script for future games ===");

    const now = new Date();
    console.log(`[INFO] Current time: ${now.toISOString()}`);

    let keptCount = 0, deletedCount = 0, skippedCount = 0;

    try {
        const gamesSnap = await db.collection('games').where('date', '>', now).get();
        console.log(`[INFO] Found ${gamesSnap.size} future games to review`);

        for (const doc of gamesSnap.docs) {
            const gameId = doc.id;
            const gameData = doc.data();

            console.log(`\n[PROCESSING] Game: ${gameId}`);
            console.log(`[DATA] date=${gameData.date?.toDate?.() || gameData.date}, max_players=${gameData.max_players}`);

            if (!gameData.teams) {
                console.log(`[SKIP] No 'teams' field → nothing to do`);
                skippedCount++;
                continue;
            }

            const hasAttendees = Array.isArray(gameData.attendees) && gameData.attendees.length > 0;
            const teamsArray = Array.isArray(gameData.teams) ? gameData.teams : [];

            console.log(`[CHECK] attendees exists? ${hasAttendees}`);
            console.log(`[CHECK] teams length: ${teamsArray.length}`);

            // Count open spots
            const openSpotsCount = teamsArray.filter(s => s.status === "open").length;
            console.log(`[CHECK] openSpotsCount=${openSpotsCount}, expected=${gameData.max_players}`);

            if (!hasAttendees && openSpotsCount === gameData.max_players) {
                console.log(`[KEEP] Keeping 'teams' field because it matches empty attendees & open spots == max_players`);
                keptCount++;
            } else {
                console.log(`[DELETE] Removing 'teams' field...`);
                await doc.ref.update({ teams: admin.firestore.FieldValue.delete() });
                console.log(`[SUCCESS] 'teams' removed for game ${gameId}`);
                deletedCount++;
            }
        }

        console.log("\n=== Summary ===");
        console.log(`[RESULT] Kept teams: ${keptCount} (no attendees & open spots matched max_players)`);
        console.log(`[RESULT] Deleted teams: ${deletedCount} (attendees existed or open spots didn't match)`);
        console.log(`[RESULT] Skipped: ${skippedCount} (no 'teams' field at all)`);

        console.log("\n=== Cleanup script completed successfully ===");
    } catch (err) {
        console.error("[ERROR] Script failed:", err);
    }
})();