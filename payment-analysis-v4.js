const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function main() {
    try {
        // 1. Deep dive on auto-removal messages: parse "users" field and count removals
        console.log('=== AUTO-REMOVAL DEEP DIVE ===\n');

        const messagesSnapshot = await db.collection('messages')
            .where('trigger', '==', 'players_auto_removed')
            .get();

        let totalPlayersRemoved = 0;
        let totalEvents = 0;
        const monthlyRemovals = {};
        const removalsByGame = {};

        messagesSnapshot.forEach(doc => {
            const data = doc.data();
            const created = data.created?.toDate();
            if (!created) return;

            const users = data.users || [];
            const gameId = data.game_id;
            const playerCount = Array.isArray(users) ? users.length : 0;

            // Also try to count from text (names separated by " & ")
            let textCount = 0;
            if (data.text) {
                const parts = data.text.split(' & ');
                // The last part contains "n'ont pas confirmé" so subtract pattern
                textCount = parts.length;
            }

            const removedCount = playerCount > 0 ? playerCount : textCount;
            totalPlayersRemoved += removedCount;
            totalEvents++;

            const month = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyRemovals[month]) monthlyRemovals[month] = { events: 0, players: 0 };
            monthlyRemovals[month].events++;
            monthlyRemovals[month].players += removedCount;

            if (gameId) {
                if (!removalsByGame[gameId]) removalsByGame[gameId] = 0;
                removalsByGame[gameId] += removedCount;
            }
        });

        console.log(`Total auto-removal events: ${totalEvents}`);
        console.log(`Total players removed: ${totalPlayersRemoved}`);
        console.log(`Avg players removed per event: ${(totalPlayersRemoved / totalEvents).toFixed(1)}`);

        console.log('\nMonth      | Events | Players Removed | Avg/Event');
        console.log('-'.repeat(55));
        Object.keys(monthlyRemovals).sort().forEach(month => {
            const m = monthlyRemovals[month];
            console.log(`${month}     | ${String(m.events).padStart(6)} | ${String(m.players).padStart(15)} | ${(m.players / m.events).toFixed(1)}`);
        });

        // Distribution of removals per game
        const gameRemovalCounts = Object.values(removalsByGame);
        if (gameRemovalCounts.length > 0) {
            console.log(`\nGames affected by auto-removals: ${gameRemovalCounts.length}`);
            const dist = {};
            gameRemovalCounts.forEach(c => {
                const bucket = c <= 3 ? String(c) : c <= 5 ? '4-5' : c <= 8 ? '6-8' : '9+';
                dist[bucket] = (dist[bucket] || 0) + 1;
            });
            console.log('Distribution of players removed per game:');
            Object.entries(dist).forEach(([bucket, count]) => {
                console.log(`  ${bucket} players: ${count} games`);
            });
        }

        // 2. Check game outcome for games that had removals
        console.log('\n=== GAME OUTCOME AFTER REMOVALS ===\n');
        const gameIds = Object.keys(removalsByGame);
        let played = 0, canceled = 0, other = 0;

        for (let i = 0; i < gameIds.length; i += 10) {
            const batch = gameIds.slice(i, i + 10);
            const docs = await Promise.all(batch.map(id => db.collection('games').doc(id).get()));
            docs.forEach(doc => {
                if (doc.exists) {
                    const status = doc.data().status;
                    if (status === 'played') played++;
                    else if (status === 'canceled' || status === 'hidden') canceled++;
                    else other++;
                }
            });
        }

        console.log(`Games with removals: ${gameIds.length}`);
        console.log(`  Played: ${played} (${((played / gameIds.length) * 100).toFixed(1)}%)`);
        console.log(`  Canceled: ${canceled} (${((canceled / gameIds.length) * 100).toFixed(1)}%)`);
        console.log(`  Other: ${other}`);

        // 3. Unique users across all in-app games - engagement metric
        console.log('\n=== UNIQUE PLAYER ENGAGEMENT ===\n');

        const allGames = await db.collection('games')
            .where('payment_type', '==', 'in-app')
            .where('status', '==', 'played')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date('2025-04-06')))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(new Date('2026-03-27')))
            .get();

        const CUTOFF = new Date('2025-10-06T22:08:00Z');
        const uniquePlayersBefore = new Set();
        const uniquePlayersAfter = new Set();

        allGames.forEach(doc => {
            const data = doc.data();
            const date = data.date?.toDate();
            if (!date) return;

            const teams = data.teams || [];
            teams.forEach(s => {
                if (s.user_id) {
                    if (date < CUTOFF) uniquePlayersBefore.add(s.user_id);
                    else uniquePlayersAfter.add(s.user_id);
                }
            });
        });

        console.log(`Unique players in played in-app games:`);
        console.log(`  BEFORE: ${uniquePlayersBefore.size}`);
        console.log(`  AFTER: ${uniquePlayersAfter.size}`);

        // Players who played both before and after
        const bothPeriods = new Set([...uniquePlayersBefore].filter(x => uniquePlayersAfter.has(x)));
        const onlyBefore = new Set([...uniquePlayersBefore].filter(x => !uniquePlayersAfter.has(x)));
        const onlyAfter = new Set([...uniquePlayersAfter].filter(x => !uniquePlayersBefore.has(x)));

        console.log(`  Both periods: ${bothPeriods.size}`);
        console.log(`  Only before: ${onlyBefore.size}`);
        console.log(`  Only after: ${onlyAfter.size}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
