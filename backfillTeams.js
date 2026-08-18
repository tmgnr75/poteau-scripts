// backfillTeams.js (run locally with `node backfillTeams.js`)
const admin = require("firebase-admin");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});


const db = admin.firestore();

async function backfillTeams() {
    const now = new Date();
    const gamesSnap = await db.collection("games")
        .where("date", ">", now)
        .get();

    console.log(`[Backfill] Found ${gamesSnap.size} future games`);

    for (const doc of gamesSnap.docs) {
        const gameId = doc.id;
        const game = doc.data();
        let attendees = game.attendees || [];
        const maxPlayers = game.max_players || 10;
        const sport = game.sport || "soccer"; // default soccer

        // Always rebuild fresh teams
        let teams = createEmptyTeams(maxPlayers);

        const userCounts = {};
        for (const att of attendees) {
            const userId = att.id;
            userCounts[userId] = (userCounts[userId] || 0) + 1;

            const openIndex = teams.findIndex((s) => s.status === "open");
            if (openIndex === -1) {
                console.warn(`[Backfill] No open spot for ${userId} in ${gameId}`);
                continue;
            }

            // soccer_position only for the first occurrence
            let position = "none";
            if (sport === "soccer" && userCounts[userId] === 1) {
                const userSnap = await db.collection("users").doc(userId).get();
                const userData = userSnap.exists ? userSnap.data() : {};
                if (userData?.soccer_position?.value) {
                    position = userData.soccer_position.value;
                }
            }

            teams[openIndex].user_id = userId;
            teams[openIndex].status = "confirmed";
            teams[openIndex].plus_one = userCounts[userId] > 1;
            teams[openIndex].position = position;
        }

        console.log(`[Backfill] Current attendees for ${gameId}:`, JSON.stringify(attendees, null, 2));
        console.log(`[Backfill] Current teams for ${gameId}:`, JSON.stringify(game.teams || [], null, 2));
        console.log(`[Backfill] Proposed new teams for ${gameId}:`, JSON.stringify(teams, null, 2));
        await db.collection("games").doc(gameId).update({ teams });
        console.log(`[Backfill] Updated ${gameId}`);
    }

    console.log("[Backfill] Done!");
    process.exit(0);
}

function createEmptyTeams(maxPlayers) {
    const teams = [];
    const half = Math.floor(maxPlayers / 2);
    for (let i = 1; i <= maxPlayers; i++) {
        teams.push({
            spot_number: i,
            team_side: i <= half ? "team_a" : "team_b",
            status: "open",
            position: "none",
        });
    }
    return teams;
}

backfillTeams().catch((err) => {
    console.error("[Backfill] Error:", err);
    process.exit(1);
});