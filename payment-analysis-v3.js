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
        // 1. Check the messages collection for players_auto_removed with more detail
        console.log('=== MESSAGES WITH TRIGGER players_auto_removed ===\n');

        const messagesSnapshot = await db.collection('messages')
            .where('trigger', '==', 'players_auto_removed')
            .get();

        console.log(`Found ${messagesSnapshot.size} messages\n`);

        // Print first 5 to understand structure
        let count = 0;
        const removedByMonth = {};
        let totalUsersRemoved = 0;
        let totalGamesWithRemovals = 0;

        messagesSnapshot.forEach(doc => {
            const data = doc.data();
            if (count < 5) {
                console.log(`Message ${doc.id}:`);
                console.log(`  trigger: ${data.trigger}`);
                console.log(`  created: ${data.created?.toDate()}`);
                console.log(`  game_ref: ${data.game_ref?.path || data.gameRef?.path}`);
                console.log(`  removed_count: ${data.removed_count}`);
                console.log(`  removedCount: ${data.removedCount}`);
                console.log(`  text: ${data.text?.substring(0, 100)}`);
                // Print all keys
                console.log(`  all keys: ${Object.keys(data).join(', ')}`);
                console.log('');
                count++;
            }

            const created = data.created?.toDate() || data.datetime?.toDate();
            if (!created || created < BEFORE_START || created > AFTER_END) return;

            const month = getMonthKey(created);
            if (!removedByMonth[month]) removedByMonth[month] = { events: 0 };
            removedByMonth[month].events++;
            totalGamesWithRemovals++;
        });

        console.log('\nMonthly auto-removal events:');
        Object.keys(removedByMonth).sort().forEach(month => {
            const m = removedByMonth[month];
            console.log(`  ${month}: ${m.events} events`);
        });

        // 2. Check connect collection structure
        console.log('\n=== CONNECT DOCS WITH TYPE players_auto_removed ===\n');

        const connectSnapshot = await db.collection('connect')
            .where('type', '==', 'players_auto_removed')
            .get();

        console.log(`Found ${connectSnapshot.size} connect docs\n`);

        count = 0;
        connectSnapshot.forEach(doc => {
            const data = doc.data();
            if (count < 5) {
                console.log(`Connect ${doc.id}:`);
                console.log(`  type: ${data.type}`);
                console.log(`  datetime: ${data.datetime?.toDate()}`);
                console.log(`  game_ref: ${data.game_ref?.path || data.gameRef?.path}`);
                console.log(`  user_ref: ${data.user_ref?.path || data.userRef?.path}`);
                console.log(`  all keys: ${Object.keys(data).join(', ')}`);
                console.log('');
                count++;
            }
        });

        // 3. Look for OTHER indicators of spot removal in games
        // Check games that went from having attendees to less attendees
        // by looking at games with payment_type=in-app and "reserved" spots that are now open
        console.log('\n=== PLAYED GAMES ANALYSIS (FRANCE ONLY - LE FIVE P18) ===\n');

        // LE FIVE Paris 18 is the main centre - let's analyze deeply
        const lefiveGames = await db.collection('games')
            .where('payment_type', '==', 'in-app')
            .where('status', '==', 'played')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
            .get();

        console.log(`Total played in-app games: ${lefiveGames.size}\n`);

        // For each played game, count attendees and check payments
        const gamePaymentStats = { before: [], after: [] };

        lefiveGames.forEach(doc => {
            const data = doc.data();
            const date = data.date?.toDate();
            if (!date) return;

            const teams = data.teams || [];
            const attendees = data.attendees || [];
            const payments = data.payments || [];

            const uniqueUsers = new Set();
            teams.forEach(s => { if (s.user_id) uniqueUsers.add(s.user_id); });
            const confirmed = teams.filter(s => s.status === 'confirmed').length;
            const reserved = teams.filter(s => s.status === 'reserved').length;
            const open = teams.filter(s => s.status === 'open' || !s.user_id).length;

            const period = date < CUTOFF_DATE ? 'before' : 'after';
            gamePaymentStats[period].push({
                id: doc.id,
                date: date,
                max_players: data.max_players || data.maxPlayers,
                unique_users: uniqueUsers.size,
                confirmed: confirmed,
                reserved: reserved,
                open: open,
                total_spots: teams.length,
                payments_count: payments.length,
                attendees_count: attendees.length,
            });
        });

        console.log('--- BEFORE (played games) ---');
        if (gamePaymentStats.before.length > 0) {
            const b = gamePaymentStats.before;
            console.log(`  Count: ${b.length}`);
            console.log(`  Avg unique users: ${(b.reduce((s, g) => s + g.unique_users, 0) / b.length).toFixed(1)}`);
            console.log(`  Avg confirmed spots: ${(b.reduce((s, g) => s + g.confirmed, 0) / b.length).toFixed(1)}`);
            console.log(`  Avg reserved spots: ${(b.reduce((s, g) => s + g.reserved, 0) / b.length).toFixed(1)}`);
            console.log(`  Avg open spots: ${(b.reduce((s, g) => s + g.open, 0) / b.length).toFixed(1)}`);
            console.log(`  Avg payments: ${(b.reduce((s, g) => s + g.payments_count, 0) / b.length).toFixed(1)}`);
        }

        console.log('\n--- AFTER (played games) ---');
        if (gamePaymentStats.after.length > 0) {
            const a = gamePaymentStats.after;
            console.log(`  Count: ${a.length}`);
            console.log(`  Avg unique users: ${(a.reduce((s, g) => s + g.unique_users, 0) / a.length).toFixed(1)}`);
            console.log(`  Avg confirmed spots: ${(a.reduce((s, g) => s + g.confirmed, 0) / a.length).toFixed(1)}`);
            console.log(`  Avg reserved spots: ${(a.reduce((s, g) => s + g.reserved, 0) / a.length).toFixed(1)}`);
            console.log(`  Avg open spots: ${(a.reduce((s, g) => s + g.open, 0) / a.length).toFixed(1)}`);
            console.log(`  Avg payments: ${(a.reduce((s, g) => s + g.payments_count, 0) / a.length).toFixed(1)}`);
        }

        // 4. CANCELED games analysis - how many had attendees before being canceled?
        console.log('\n=== CANCELED GAMES ANALYSIS ===\n');

        const canceledGames = await db.collection('games')
            .where('payment_type', '==', 'in-app')
            .where('status', 'in', ['canceled', 'hidden'])
            .where('date', '>=', admin.firestore.Timestamp.fromDate(BEFORE_START))
            .where('date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
            .get();

        const canceledStats = { before: { total: 0, withAttendees: 0, attendeeCounts: [] }, after: { total: 0, withAttendees: 0, attendeeCounts: [] } };

        canceledGames.forEach(doc => {
            const data = doc.data();
            const date = data.date?.toDate();
            if (!date) return;
            const period = date < CUTOFF_DATE ? 'before' : 'after';
            const attendees = (data.attendees || []).length;
            const teams = data.teams || [];
            const uniqueUsers = new Set();
            teams.forEach(s => { if (s.user_id) uniqueUsers.add(s.user_id); });

            canceledStats[period].total++;
            if (uniqueUsers.size > 0) {
                canceledStats[period].withAttendees++;
                canceledStats[period].attendeeCounts.push(uniqueUsers.size);
            }
        });

        console.log('--- BEFORE ---');
        console.log(`  Total canceled: ${canceledStats.before.total}`);
        console.log(`  With remaining attendees: ${canceledStats.before.withAttendees} (${((canceledStats.before.withAttendees / canceledStats.before.total) * 100).toFixed(1)}%)`);
        if (canceledStats.before.attendeeCounts.length > 0) {
            console.log(`  Avg attendees on canceled: ${(canceledStats.before.attendeeCounts.reduce((a, b) => a + b, 0) / canceledStats.before.attendeeCounts.length).toFixed(1)}`);
        }

        console.log('\n--- AFTER ---');
        console.log(`  Total canceled: ${canceledStats.after.total}`);
        console.log(`  With remaining attendees: ${canceledStats.after.withAttendees} (${((canceledStats.after.withAttendees / canceledStats.after.total) * 100).toFixed(1)}%)`);
        if (canceledStats.after.attendeeCounts.length > 0) {
            console.log(`  Avg attendees on canceled: ${(canceledStats.after.attendeeCounts.reduce((a, b) => a + b, 0) / canceledStats.after.attendeeCounts.length).toFixed(1)}`);
        }

        // 5. Reserved payments that never converted - potential lost revenue
        console.log('\n=== RESERVED PAYMENTS (NEVER CAPTURED) - POTENTIAL LOST REVENUE ===\n');

        const allPayments = await db.collection('payments')
            .where('authorization_date', '>=', admin.firestore.Timestamp.fromDate(CUTOFF_DATE))
            .where('authorization_date', '<=', admin.firestore.Timestamp.fromDate(AFTER_END))
            .orderBy('authorization_date')
            .get();

        let totalReservedAmount = 0;
        let totalCapturedAmount = 0;
        let reservedCount = 0;
        let capturedCount = 0;

        allPayments.forEach(doc => {
            const data = doc.data();
            if (data.status === 'reserved') {
                totalReservedAmount += (data.amount || 0);
                reservedCount++;
            } else if (data.status === 'captured') {
                totalCapturedAmount += (data.amount || 0);
                capturedCount++;
            }
        });

        console.log(`After the change:`);
        console.log(`  Captured: ${capturedCount} payments, €${totalCapturedAmount.toFixed(2)}`);
        console.log(`  Reserved (never captured): ${reservedCount} payments, €${totalReservedAmount.toFixed(2)}`);
        console.log(`  Lost conversion rate: ${((reservedCount / (reservedCount + capturedCount)) * 100).toFixed(1)}%`);
        console.log(`  Potential lost revenue: €${totalReservedAmount.toFixed(2)}`);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
