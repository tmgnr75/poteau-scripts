const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
    console.log(`[initTeams][START] Script started at ${new Date().toISOString()}`);

    const now = new Date();
    console.log(`[initTeams] Current time: ${now.toISOString()}`);

    try {
        const gamesRef = db.collection('games');
        const snapshot = await gamesRef
            .where('date', '>=', now)
            .where('status', '==', 'published')
            .where('type', '==', 'pro')
            .get();

        console.log(`[initTeams] Found ${snapshot.size} published pro games scheduled after now.`);

        if (snapshot.empty) {
            console.log(`[initTeams] No games found. Exiting.`);
            process.exit(0);
        }

        for (const doc of snapshot.docs) {
            const gameId = doc.id;
            const gameData = doc.data();
            console.log(`\n[initTeams][${gameId}] Processing game with date ${gameData.date.toDate?.() || gameData.date} and max_players=${gameData.max_players}`);

            const attendees = gameData.attendees || [];
            const teams = gameData.teams || null;

            if (attendees.length > 0) {
                console.log(`[initTeams][${gameId}] Skipped: attendees already set (${attendees.length}).`);
                continue;
            }

            if (teams && teams.length > 0) {
                console.log(`[initTeams][${gameId}] Skipped: teams already initialized (${teams.length} spots).`);
                continue;
            }

            const maxPlayers = gameData.max_players;
            if (!maxPlayers || maxPlayers <= 0) {
                console.log(`[initTeams][${gameId}] Skipped: invalid max_players (${maxPlayers}).`);
                continue;
            }

            const spots = [];
            const half = Math.floor(maxPlayers / 2);
            const extra = maxPlayers % 2;

            for (let i = 0; i < maxPlayers; i++) {
                const team_side = i < half ? 'team_a' : 'team_b';
                if (extra && i === maxPlayers - 1 && half * 2 !== maxPlayers) {
                    // assign the last odd spot to team_b by default
                    console.log(`[initTeams][${gameId}] Uneven player count, assigning last spot to team_b.`);
                }

                spots.push({
                    spot_number: i + 1,
                    team_side,
                    status: 'open',
                    position: null,
                    user_id: null,
                    plus_one: false,
                });
            }

            await doc.ref.update({ teams: spots });
            console.log(`[initTeams][${gameId}] ✅ Initialized ${spots.length} open spots (${half} per team).`);
        }

        console.log(`\n[initTeams][END] Script completed successfully at ${new Date().toISOString()}`);
        process.exit(0);
    } catch (error) {
        console.error(`[initTeams][ERROR] ${error.message}`, error);
        process.exit(1);
    }
})();