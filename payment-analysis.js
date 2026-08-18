const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// The new payment system was deployed on October 6, 2025 10:08 PM
const CUTOFF_DATE = new Date('2025-10-06T22:08:00Z');

// Analysis window: 6 months before and after the change
const BEFORE_START = new Date('2025-04-06T00:00:00Z');
const AFTER_END = new Date('2026-03-27T23:59:59Z');

function getWeekKey(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
}

function getMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchAllPayments() {
    console.log('Fetching payments...');
    const payments = [];

    const snapshot = await db.collection('payments')
        .where('authorization_date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
        .where('authorization_date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
        .orderBy('authorization_date')
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        payments.push({
            id: doc.id,
            status: data.status,
            amount: data.amount,
            currency: data.currency,
            spots: data.spots || 1,
            authorization_date: data.authorization_date?.toDate(),
            game_ref: data.game_ref,
            user_ref: data.user_ref,
        });
    });

    console.log(`  Found ${payments.length} payments`);
    return payments;
}

async function fetchInAppGames() {
    console.log('Fetching in-app payment games...');
    const games = [];

    const snapshot = await db.collection('games')
        .where('payment_type', '==', 'in-app')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
        .where('date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        const teams = data.teams || [];
        const attendees = data.attendees || [];

        const confirmedSpots = teams.filter(s => s.status === 'confirmed').length;
        const reservedSpots = teams.filter(s => s.status === 'reserved').length;
        const openSpots = teams.filter(s => s.status === 'open' || !s.status).length;
        const totalSpots = teams.length;

        // Count unique users
        const uniqueUsers = new Set();
        teams.forEach(s => { if (s.user_id) uniqueUsers.add(s.user_id); });

        games.push({
            id: doc.id,
            date: data.date?.toDate(),
            status: data.status,
            sport: data.sport,
            payment_type: data.payment_type,
            max_players: data.max_players || data.maxPlayers,
            attendees_count: attendees.length,
            confirmed_spots: confirmedSpots,
            reserved_spots: reservedSpots,
            open_spots: openSpots,
            total_spots: totalSpots,
            unique_users: uniqueUsers.size,
            organizer: data.organizer,
            centre: data.centre,
            country: data.country,
        });
    });

    console.log(`  Found ${games.length} in-app games`);
    return games;
}

async function fetchAutoRemovedMessages() {
    console.log('Fetching auto-removal notifications (connect collection)...');
    const removals = [];

    // Look for connect docs with type "players_auto_removed"
    const snapshot = await db.collection('connect')
        .where('type', '==', 'players_auto_removed')
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        const datetime = data.datetime?.toDate() || data.created?.toDate();
        if (datetime && datetime >= BEFORE_START && datetime <= AFTER_END) {
            removals.push({
                id: doc.id,
                datetime: datetime,
                game_ref: data.game_ref || data.gameRef,
                user_ref: data.user_ref || data.userRef,
            });
        }
    });

    console.log(`  Found ${removals.length} auto-removal events`);
    return removals;
}

async function fetchMessages() {
    console.log('Fetching auto-removal messages...');
    const messages = [];

    const snapshot = await db.collection('messages')
        .where('trigger', '==', 'players_auto_removed')
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        const created = data.created?.toDate() || data.datetime?.toDate();
        if (created && created >= BEFORE_START && created <= AFTER_END) {
            messages.push({
                id: doc.id,
                created: created,
                game_ref: data.game_ref || data.gameRef,
                removed_count: data.removed_count || data.removedCount,
            });
        }
    });

    console.log(`  Found ${messages.length} auto-removal messages`);
    return messages;
}

function analyzePayments(payments) {
    console.log('\n========================================');
    console.log('  PAYMENT ANALYSIS');
    console.log('========================================\n');

    const captured = payments.filter(p => p.status === 'captured');
    const reserved = payments.filter(p => p.status === 'reserved');
    const abandoned = payments.filter(p => p.status === 'abandoned');

    console.log(`Total payments: ${payments.length}`);
    console.log(`  Captured: ${captured.length}`);
    console.log(`  Reserved (still pending): ${reserved.length}`);
    console.log(`  Abandoned: ${abandoned.length}`);
    console.log(`  Conversion rate: ${((captured.length / payments.length) * 100).toFixed(1)}%`);

    // Before vs After
    const beforePayments = captured.filter(p => p.authorization_date < CUTOFF_DATE);
    const afterPayments = captured.filter(p => p.authorization_date >= CUTOFF_DATE);

    console.log(`\n--- BEFORE change (before Oct 6, 2025) ---`);
    console.log(`  Captured payments: ${beforePayments.length}`);
    console.log(`  Total spots paid: ${beforePayments.reduce((sum, p) => sum + (p.spots || 1), 0)}`);
    console.log(`  Total revenue: €${beforePayments.filter(p => p.currency === 'eur' || p.currency === 'EUR').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`);

    console.log(`\n--- AFTER change (from Oct 6, 2025) ---`);
    console.log(`  Captured payments: ${afterPayments.length}`);
    console.log(`  Total spots paid: ${afterPayments.reduce((sum, p) => sum + (p.spots || 1), 0)}`);
    console.log(`  Total revenue: €${afterPayments.filter(p => p.currency === 'eur' || p.currency === 'EUR').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}`);

    // Weekly breakdown
    console.log('\n--- WEEKLY CAPTURED PAYMENTS ---');
    const weeklyBefore = {};
    const weeklyAfter = {};

    beforePayments.forEach(p => {
        const week = getWeekKey(p.authorization_date);
        weeklyBefore[week] = (weeklyBefore[week] || 0) + 1;
    });

    afterPayments.forEach(p => {
        const week = getWeekKey(p.authorization_date);
        weeklyAfter[week] = (weeklyAfter[week] || 0) + 1;
    });

    const allWeeks = [...new Set([...Object.keys(weeklyBefore), ...Object.keys(weeklyAfter)])].sort();

    console.log('\nWeek (Monday) | Payments | Period');
    console.log('-'.repeat(50));
    allWeeks.forEach(week => {
        const count = weeklyBefore[week] || weeklyAfter[week] || 0;
        const period = new Date(week) < CUTOFF_DATE ? 'BEFORE' : 'AFTER';
        console.log(`${week}    | ${String(count).padStart(8)} | ${period}`);
    });

    // Averages
    const beforeWeeks = Object.keys(weeklyBefore).length;
    const afterWeeks = Object.keys(weeklyAfter).length;
    const beforeAvg = beforeWeeks > 0 ? (beforePayments.length / beforeWeeks).toFixed(1) : 0;
    const afterAvg = afterWeeks > 0 ? (afterPayments.length / afterWeeks).toFixed(1) : 0;

    console.log(`\nAverage payments/week BEFORE: ${beforeAvg} (over ${beforeWeeks} weeks)`);
    console.log(`Average payments/week AFTER: ${afterAvg} (over ${afterWeeks} weeks)`);
    console.log(`Change: ${((afterAvg - beforeAvg) / beforeAvg * 100).toFixed(1)}%`);

    // Monthly breakdown
    console.log('\n--- MONTHLY CAPTURED PAYMENTS ---');
    const monthly = {};
    captured.forEach(p => {
        const month = getMonthKey(p.authorization_date);
        if (!monthly[month]) monthly[month] = { count: 0, revenue_eur: 0, spots: 0 };
        monthly[month].count++;
        monthly[month].spots += (p.spots || 1);
        if (p.currency === 'eur' || p.currency === 'EUR') {
            monthly[month].revenue_eur += p.amount;
        }
    });

    console.log('\nMonth      | Payments | Spots | Revenue (EUR)');
    console.log('-'.repeat(55));
    Object.keys(monthly).sort().forEach(month => {
        const m = monthly[month];
        const period = new Date(month + '-15') < CUTOFF_DATE ? ' [BEFORE]' : ' [AFTER]';
        console.log(`${month}     | ${String(m.count).padStart(8)} | ${String(m.spots).padStart(5)} | €${m.revenue_eur.toFixed(2)}${period}`);
    });

    // Abandoned payment analysis (only relevant after the change)
    console.log('\n--- ABANDONED PAYMENTS (after change) ---');
    const abandonedAfter = abandoned.filter(p => p.authorization_date >= CUTOFF_DATE);
    const capturedAfter = captured.filter(p => p.authorization_date >= CUTOFF_DATE);
    console.log(`Abandoned: ${abandonedAfter.length}`);
    console.log(`Captured: ${capturedAfter.length}`);
    console.log(`Abandon rate: ${((abandonedAfter.length / (abandonedAfter.length + capturedAfter.length)) * 100).toFixed(1)}%`);
}

function analyzeGames(games) {
    console.log('\n========================================');
    console.log('  IN-APP GAME ANALYSIS');
    console.log('========================================\n');

    const beforeGames = games.filter(g => g.date < CUTOFF_DATE);
    const afterGames = games.filter(g => g.date >= CUTOFF_DATE);

    console.log(`Total in-app games: ${games.length}`);
    console.log(`  Before: ${beforeGames.length}`);
    console.log(`  After: ${afterGames.length}`);

    // Game status breakdown
    console.log('\n--- GAME STATUS (BEFORE) ---');
    const statusBefore = {};
    beforeGames.forEach(g => { statusBefore[g.status] = (statusBefore[g.status] || 0) + 1; });
    Object.entries(statusBefore).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} (${((count / beforeGames.length) * 100).toFixed(1)}%)`);
    });

    console.log('\n--- GAME STATUS (AFTER) ---');
    const statusAfter = {};
    afterGames.forEach(g => { statusAfter[g.status] = (statusAfter[g.status] || 0) + 1; });
    Object.entries(statusAfter).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} (${((count / afterGames.length) * 100).toFixed(1)}%)`);
    });

    // Fill rate analysis
    console.log('\n--- FILL RATE (played games only) ---');
    const playedBefore = beforeGames.filter(g => g.status === 'played');
    const playedAfter = afterGames.filter(g => g.status === 'played');

    if (playedBefore.length > 0) {
        const avgFillBefore = playedBefore.reduce((sum, g) => {
            const fill = g.max_players > 0 ? g.unique_users / g.max_players : 0;
            return sum + fill;
        }, 0) / playedBefore.length;
        console.log(`  BEFORE - Played games: ${playedBefore.length}, Avg fill rate: ${(avgFillBefore * 100).toFixed(1)}%`);
    }

    if (playedAfter.length > 0) {
        const avgFillAfter = playedAfter.reduce((sum, g) => {
            const fill = g.max_players > 0 ? g.unique_users / g.max_players : 0;
            return sum + fill;
        }, 0) / playedAfter.length;
        console.log(`  AFTER - Played games: ${playedAfter.length}, Avg fill rate: ${(avgFillAfter * 100).toFixed(1)}%`);
    }

    // Current reserved spots in upcoming games (shows the "unreserve" problem)
    const upcomingGames = afterGames.filter(g => g.status === 'published' && g.date > new Date());
    if (upcomingGames.length > 0) {
        console.log(`\n--- UPCOMING IN-APP GAMES (current snapshot) ---`);
        console.log(`  Total upcoming: ${upcomingGames.length}`);
        const totalReserved = upcomingGames.reduce((sum, g) => sum + g.reserved_spots, 0);
        const totalConfirmed = upcomingGames.reduce((sum, g) => sum + g.confirmed_spots, 0);
        const totalOpen = upcomingGames.reduce((sum, g) => sum + g.open_spots, 0);
        console.log(`  Total reserved spots: ${totalReserved}`);
        console.log(`  Total confirmed spots: ${totalConfirmed}`);
        console.log(`  Total open spots: ${totalOpen}`);
    }

    // Monthly game counts
    console.log('\n--- MONTHLY IN-APP GAMES ---');
    const monthlyGames = {};
    games.forEach(g => {
        const month = getMonthKey(g.date);
        if (!monthlyGames[month]) monthlyGames[month] = { total: 0, played: 0, canceled: 0, hidden: 0, published: 0, avgUsers: [] };
        monthlyGames[month].total++;
        if (g.status === 'played') { monthlyGames[month].played++; monthlyGames[month].avgUsers.push(g.unique_users); }
        if (g.status === 'canceled') monthlyGames[month].canceled++;
        if (g.status === 'hidden') monthlyGames[month].hidden++;
        if (g.status === 'published') monthlyGames[month].published++;
    });

    console.log('\nMonth      | Total | Played | Canceled+Hidden | Avg Players/Game');
    console.log('-'.repeat(65));
    Object.keys(monthlyGames).sort().forEach(month => {
        const m = monthlyGames[month];
        const avgPlayers = m.avgUsers.length > 0 ? (m.avgUsers.reduce((a, b) => a + b, 0) / m.avgUsers.length).toFixed(1) : '-';
        const period = new Date(month + '-15') < CUTOFF_DATE ? ' [BEFORE]' : ' [AFTER]';
        console.log(`${month}     | ${String(m.total).padStart(5)} | ${String(m.played).padStart(6)} | ${String(m.canceled + m.hidden).padStart(15)} | ${String(avgPlayers).padStart(16)}${period}`);
    });

    // Country breakdown (if available)
    const countries = {};
    games.forEach(g => {
        const country = g.country || 'unknown';
        if (!countries[country]) countries[country] = { before: 0, after: 0 };
        if (g.date < CUTOFF_DATE) countries[country].before++;
        else countries[country].after++;
    });

    if (Object.keys(countries).length > 1) {
        console.log('\n--- BY COUNTRY ---');
        Object.entries(countries).sort((a, b) => (b[1].before + b[1].after) - (a[1].before + a[1].after)).forEach(([country, counts]) => {
            console.log(`  ${country}: Before=${counts.before}, After=${counts.after}`);
        });
    }
}

function analyzeAutoRemovals(removals, messages) {
    console.log('\n========================================');
    console.log('  AUTO-REMOVAL ANALYSIS (unreserveSpots)');
    console.log('========================================\n');

    if (removals.length === 0 && messages.length === 0) {
        console.log('No auto-removal data found in connect/messages collections.');
        console.log('This feature only exists in the new system.');
        return;
    }

    // Use messages as primary source (one per game event)
    if (messages.length > 0) {
        console.log(`Auto-removal events (from messages): ${messages.length}`);

        const monthly = {};
        messages.forEach(m => {
            const month = getMonthKey(m.created);
            if (!monthly[month]) monthly[month] = { events: 0, totalRemoved: 0 };
            monthly[month].events++;
            monthly[month].totalRemoved += (m.removed_count || 0);
        });

        console.log('\nMonth      | Removal Events | Players Removed');
        console.log('-'.repeat(50));
        Object.keys(monthly).sort().forEach(month => {
            const m = monthly[month];
            console.log(`${month}     | ${String(m.events).padStart(14)} | ${String(m.totalRemoved).padStart(15)}`);
        });
    }

    // Connect docs (one per user removed)
    if (removals.length > 0) {
        console.log(`\nIndividual player removals (from connect): ${removals.length}`);

        const monthly = {};
        removals.forEach(r => {
            const month = getMonthKey(r.datetime);
            monthly[month] = (monthly[month] || 0) + 1;
        });

        console.log('\nMonth      | Players Auto-Removed');
        console.log('-'.repeat(35));
        Object.keys(monthly).sort().forEach(month => {
            console.log(`${month}     | ${monthly[month]}`);
        });
    }
}

async function main() {
    try {
        console.log('=================================================');
        console.log('  POTEAU PAYMENT SYSTEM ANALYSIS');
        console.log(`  Cutoff date: October 6, 2025 (new system)`);
        console.log(`  Analysis range: ${BEFORE_START.toISOString().split('T')[0]} to ${AFTER_END.toISOString().split('T')[0]}`);
        console.log('=================================================\n');

        // Fetch all data in parallel
        const [payments, games, removals, messages] = await Promise.all([
            fetchAllPayments(),
            fetchInAppGames(),
            fetchAutoRemovedMessages(),
            fetchMessages(),
        ]);

        // Analyze
        analyzePayments(payments);
        analyzeGames(games);
        analyzeAutoRemovals(removals, messages);

        console.log('\n========================================');
        console.log('  DONE');
        console.log('========================================');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
