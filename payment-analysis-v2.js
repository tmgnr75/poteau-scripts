const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const CUTOFF_DATE = new Date('2025-10-06T22:08:00Z');
const BEFORE_START = new Date('2025-04-06T00:00:00Z');
const AFTER_END = new Date('2026-03-27T23:59:59Z');

function getMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function main() {
    try {
        // 1. Fetch ALL payments in range (single index on authorization_date)
        console.log('Fetching all payments...');
        const paymentsSnapshot = await db.collection('payments')
            .where('authorization_date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
            .where('authorization_date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
            .orderBy('authorization_date')
            .get();

        const payments = [];
        paymentsSnapshot.forEach(doc => {
            const data = doc.data();
            payments.push({
                id: doc.id,
                status: data.status,
                amount: data.amount,
                currency: data.currency,
                spots: data.spots || 1,
                authorization_date: data.authorization_date?.toDate(),
                game_ref_id: data.game_ref?.id,
                user_ref_id: data.user_ref?.id,
            });
        });
        console.log(`  Found ${payments.length} payments\n`);

        // 1a. Reserved payment analysis (filter in memory)
        console.log('=== RESERVED (PENDING) PAYMENT ANALYSIS ===\n');
        const reserved = payments.filter(p => p.status === 'reserved');
        const reservedBefore = reserved.filter(p => p.authorization_date < CUTOFF_DATE);
        const reservedAfter = reserved.filter(p => p.authorization_date >= CUTOFF_DATE);

        console.log(`Total reserved payments: ${reserved.length}`);
        console.log(`  Before change: ${reservedBefore.length}`);
        console.log(`  After change: ${reservedAfter.length}`);

        const reservedByMonth = {};
        reserved.forEach(p => {
            const month = getMonthKey(p.authorization_date);
            reservedByMonth[month] = (reservedByMonth[month] || 0) + 1;
        });
        console.log('\nMonthly reserved (stale) payments:');
        Object.keys(reservedByMonth).sort().forEach(month => {
            console.log(`  ${month}: ${reservedByMonth[month]}`);
        });

        // 1b. Payment conversion by month
        console.log('\n=== PAYMENT CONVERSION BY MONTH ===\n');
        const paymentsByMonth = {};
        payments.forEach(p => {
            const month = getMonthKey(p.authorization_date);
            if (!paymentsByMonth[month]) paymentsByMonth[month] = { captured: 0, reserved: 0, abandoned: 0, total: 0 };
            paymentsByMonth[month].total++;
            paymentsByMonth[month][p.status] = (paymentsByMonth[month][p.status] || 0) + 1;
        });

        console.log('Month      | Total | Captured | Reserved | Abandoned | Conversion Rate');
        console.log('-'.repeat(75));
        Object.keys(paymentsByMonth).sort().forEach(month => {
            const m = paymentsByMonth[month];
            const rate = m.total > 0 ? ((m.captured / m.total) * 100).toFixed(1) : '0.0';
            const period = new Date(month + '-15') < CUTOFF_DATE ? ' [BEFORE]' : ' [AFTER]';
            console.log(`${month}     | ${String(m.total).padStart(5)} | ${String(m.captured || 0).padStart(8)} | ${String(m.reserved || 0).padStart(8)} | ${String(m.abandoned || 0).padStart(9)} | ${rate}%${period}`);
        });

        // 2. Fetch all in-app games
        console.log('\nFetching in-app games...');
        const gamesSnapshot = await db.collection('games')
            .where('payment_type', '==', 'in-app')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
            .get();

        const organizerIds = new Set();
        const gamesData = [];

        gamesSnapshot.forEach(doc => {
            const data = doc.data();
            const organizer = data.organizer;
            if (organizer) organizerIds.add(organizer);

            const teams = data.teams || [];
            const uniqueUsers = new Set();
            teams.forEach(s => { if (s.user_id) uniqueUsers.add(s.user_id); });

            gamesData.push({
                id: doc.id,
                date: data.date?.toDate(),
                status: data.status,
                organizer: organizer,
                sport: data.sport,
                max_players: data.max_players || data.maxPlayers,
                unique_users: uniqueUsers.size,
                confirmed_spots: teams.filter(s => s.status === 'confirmed').length,
                reserved_spots: teams.filter(s => s.status === 'reserved').length,
                attendees_count: (data.attendees || []).length,
            });
        });
        console.log(`  Found ${gamesData.length} in-app games`);

        // Fetch organizer profiles
        console.log(`Fetching ${organizerIds.size} organizer profiles...`);
        const organizerCountry = {};
        const organizerCentre = {};
        const orgArray = Array.from(organizerIds);

        for (let i = 0; i < orgArray.length; i += 10) {
            const batch = orgArray.slice(i, i + 10);
            const docs = await Promise.all(batch.map(id => db.collection('users').doc(id).get()));
            docs.forEach(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    organizerCountry[doc.id] = data.centre_country || 'unknown';
                    organizerCentre[doc.id] = data.centre_name || data.display_name || 'unknown';
                }
            });
        }

        gamesData.forEach(g => {
            g.country = organizerCountry[g.organizer] || 'unknown';
            g.centre_name = organizerCentre[g.organizer] || 'unknown';
        });

        // 3. Games by country
        console.log('\n=== GAMES BY COUNTRY ===\n');
        const countries = {};
        gamesData.forEach(g => {
            const country = g.country;
            if (!countries[country]) countries[country] = {
                before: { total: 0, played: 0, canceled: 0, users: [] },
                after: { total: 0, played: 0, canceled: 0, users: [] }
            };
            const period = g.date < CUTOFF_DATE ? 'before' : 'after';
            countries[country][period].total++;
            if (g.status === 'played') {
                countries[country][period].played++;
                countries[country][period].users.push(g.unique_users);
            }
            if (g.status === 'canceled' || g.status === 'hidden') countries[country][period].canceled++;
        });

        Object.entries(countries).sort((a, b) => (b[1].before.total + b[1].after.total) - (a[1].before.total + a[1].after.total)).forEach(([country, data]) => {
            console.log(`--- ${country} ---`);
            console.log(`  BEFORE: ${data.before.total} games, ${data.before.played} played, ${data.before.canceled} canceled`);
            if (data.before.total > 0) console.log(`    Play rate: ${((data.before.played / data.before.total) * 100).toFixed(1)}%`);
            if (data.before.users.length > 0) console.log(`    Avg players/played game: ${(data.before.users.reduce((a, b) => a + b, 0) / data.before.users.length).toFixed(1)}`);
            console.log(`  AFTER: ${data.after.total} games, ${data.after.played} played, ${data.after.canceled} canceled`);
            if (data.after.total > 0) console.log(`    Play rate: ${((data.after.played / data.after.total) * 100).toFixed(1)}%`);
            if (data.after.users.length > 0) console.log(`    Avg players/played game: ${(data.after.users.reduce((a, b) => a + b, 0) / data.after.users.length).toFixed(1)}`);
            console.log('');
        });

        // 4. Monthly breakdown by country
        console.log('=== MONTHLY BREAKDOWN BY COUNTRY ===\n');
        const monthlyByCountry = {};
        gamesData.forEach(g => {
            const month = getMonthKey(g.date);
            const country = g.country;
            const key = `${country}|${month}`;
            if (!monthlyByCountry[key]) monthlyByCountry[key] = { country, month, total: 0, played: 0, canceled: 0, users: [] };
            monthlyByCountry[key].total++;
            if (g.status === 'played') {
                monthlyByCountry[key].played++;
                monthlyByCountry[key].users.push(g.unique_users);
            }
            if (g.status === 'canceled' || g.status === 'hidden') monthlyByCountry[key].canceled++;
        });

        // Group by country
        const countryList = [...new Set(gamesData.map(g => g.country))].sort();
        countryList.forEach(country => {
            console.log(`--- ${country} ---`);
            console.log('Month      | Total | Played | Canceled | Play Rate | Avg Players');
            console.log('-'.repeat(70));
            const entries = Object.values(monthlyByCountry).filter(m => m.country === country).sort((a, b) => a.month.localeCompare(b.month));
            entries.forEach(m => {
                const playRate = m.total > 0 ? ((m.played / m.total) * 100).toFixed(1) : '0.0';
                const avgPlayers = m.users.length > 0 ? (m.users.reduce((a, b) => a + b, 0) / m.users.length).toFixed(1) : '-';
                const period = new Date(m.month + '-15') < CUTOFF_DATE ? ' [B]' : ' [A]';
                console.log(`${m.month}     | ${String(m.total).padStart(5)} | ${String(m.played).padStart(6)} | ${String(m.canceled).padStart(8)} | ${playRate.padStart(8)}% | ${String(avgPlayers).padStart(11)}${period}`);
            });
            console.log('');
        });

        // 5. Top centres
        console.log('=== TOP 15 CENTRES ===\n');
        const centreStats = {};
        gamesData.forEach(g => {
            const key = `${g.centre_name} (${g.country})`;
            if (!centreStats[key]) centreStats[key] = {
                before: { total: 0, played: 0, users: [] },
                after: { total: 0, played: 0, users: [] }
            };
            const period = g.date < CUTOFF_DATE ? 'before' : 'after';
            centreStats[key][period].total++;
            if (g.status === 'played') {
                centreStats[key][period].played++;
                centreStats[key][period].users.push(g.unique_users);
            }
        });

        const topCentres = Object.entries(centreStats)
            .sort((a, b) => (b[1].before.total + b[1].after.total) - (a[1].before.total + a[1].after.total))
            .slice(0, 15);

        console.log('Centre                                    | BEFORE played/total | AFTER played/total | Avg B | Avg A');
        console.log('-'.repeat(105));
        topCentres.forEach(([name, data]) => {
            const avgB = data.before.users.length > 0 ? (data.before.users.reduce((a, b) => a + b, 0) / data.before.users.length).toFixed(1) : '-';
            const avgA = data.after.users.length > 0 ? (data.after.users.reduce((a, b) => a + b, 0) / data.after.users.length).toFixed(1) : '-';
            const n = name.substring(0, 42).padEnd(42);
            console.log(`${n}| ${String(data.before.played).padStart(6)}/${String(data.before.total).padStart(5)} | ${String(data.after.played).padStart(5)}/${String(data.after.total).padStart(5)} | ${String(avgB).padStart(5)} | ${String(avgA).padStart(5)}`);
        });

        // 6. Auto-removal analysis
        console.log('\n=== AUTO-REMOVAL ANALYSIS ===\n');
        const connectSnapshot = await db.collection('connect')
            .where('type', '==', 'players_auto_removed')
            .get();

        const removalsByGame = {};
        connectSnapshot.forEach(doc => {
            const data = doc.data();
            const gameRef = data.game_ref || data.gameRef;
            const gameId = gameRef?.id || 'unknown';
            const datetime = data.datetime?.toDate();
            if (!datetime || datetime < BEFORE_START || datetime > AFTER_END) return;
            if (!removalsByGame[gameId]) removalsByGame[gameId] = { count: 0, date: datetime };
            removalsByGame[gameId].count++;
        });

        const removalCounts = Object.values(removalsByGame).map(r => r.count);
        if (removalCounts.length > 0) {
            const totalRemoved = removalCounts.reduce((a, b) => a + b, 0);
            console.log(`Games with auto-removals: ${removalCounts.length}`);
            console.log(`Total players auto-removed: ${totalRemoved}`);
            console.log(`Avg players removed per game: ${(totalRemoved / removalCounts.length).toFixed(1)}`);
            console.log(`Max players removed in one game: ${Math.max(...removalCounts)}`);

            const dist = {};
            removalCounts.forEach(c => { dist[c] = (dist[c] || 0) + 1; });
            console.log('\nDistribution:');
            Object.keys(dist).sort((a, b) => Number(a) - Number(b)).forEach(count => {
                console.log(`  ${count} player(s) removed: ${dist[count]} games`);
            });

            // Monthly
            const removalsByMonth = {};
            Object.values(removalsByGame).forEach(r => {
                const month = getMonthKey(r.date);
                if (!removalsByMonth[month]) removalsByMonth[month] = { games: 0, players: 0 };
                removalsByMonth[month].games++;
                removalsByMonth[month].players += r.count;
            });
            console.log('\nMonth      | Games w/ removals | Players removed');
            console.log('-'.repeat(50));
            Object.keys(removalsByMonth).sort().forEach(month => {
                const m = removalsByMonth[month];
                console.log(`${month}     | ${String(m.games).padStart(17)} | ${String(m.players).padStart(15)}`);
            });
        }

        // 7. Game outcome after auto-removal
        console.log('\n=== GAME OUTCOME AFTER AUTO-REMOVAL ===\n');
        const gameIdsWithRemovals = Object.keys(removalsByGame);
        let playedAfterRemoval = 0;
        let canceledAfterRemoval = 0;
        let otherAfterRemoval = 0;

        for (let i = 0; i < gameIdsWithRemovals.length; i += 10) {
            const batch = gameIdsWithRemovals.slice(i, i + 10);
            const docs = await Promise.all(batch.map(id => db.collection('games').doc(id).get()));
            docs.forEach(doc => {
                if (doc.exists) {
                    const status = doc.data().status;
                    if (status === 'played') playedAfterRemoval++;
                    else if (status === 'canceled' || status === 'hidden') canceledAfterRemoval++;
                    else otherAfterRemoval++;
                }
            });
        }

        if (gameIdsWithRemovals.length > 0) {
            console.log(`Games with auto-removals: ${gameIdsWithRemovals.length}`);
            console.log(`  Ended up played: ${playedAfterRemoval} (${((playedAfterRemoval / gameIdsWithRemovals.length) * 100).toFixed(1)}%)`);
            console.log(`  Ended up canceled: ${canceledAfterRemoval} (${((canceledAfterRemoval / gameIdsWithRemovals.length) * 100).toFixed(1)}%)`);
            console.log(`  Still published/other: ${otherAfterRemoval}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
