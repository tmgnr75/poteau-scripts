const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function exportGames() {
    // 12 months ago from now
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const now = new Date();

    console.log(`Exporting played games from ${twelveMonthsAgo.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}...`);

    // Query: played games in the last 12 months, date in the past
    const snapshot = await db.collection('games')
        .where('status', '==', 'played')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(twelveMonthsAgo))
        .where('date', '<=', admin.firestore.Timestamp.fromDate(now))
        .get();

    console.log(`Found ${snapshot.size} played games in the last 12 months`);

    const games = [];
    let count = 0;

    snapshot.forEach(doc => {
        const data = doc.data();

        // Count actual attendees (non-null DocumentReferences)
        let attendeeCount = 0;
        const attendeeIds = [];
        if (Array.isArray(data.attendees)) {
            data.attendees.forEach(a => {
                if (a instanceof admin.firestore.DocumentReference) {
                    attendeeCount++;
                    const uid = a.path.split('/')[1];
                    if (!attendeeIds.includes(uid)) {
                        attendeeIds.push(uid);
                    }
                }
            });
        }

        const game = {
            id: doc.id,
            date: data.date?.toDate().toISOString() || null,
            end_time: data.end_time?.toDate().toISOString() || null,
            created_on: data.created_on?.toDate().toISOString() || null,
            centre: data.centre || null,
            place_id: data.place_id || null,
            address: data.address || null,
            sport: data.sport || null,
            status: data.status,
            type: data.type || null,
            organizer: data.organizer || null,
            max_players: data.max_players || null,
            attendee_count: attendeeCount,
            unique_attendee_count: attendeeIds.length,
            attendee_ids: attendeeIds,
            duration: data.duration || null,
            price: data.price || null,
            currency: data.currency || null,
            payment_type: data.payment_type || null,
            country_code: data.country_code || null,
            time_zone: data.time_zone || null,
            gold_exclusive: data.gold_exclusive || false,
            has_repeater: !!data.repeater,
        };

        games.push(game);
        count++;
        if (count % 5000 === 0) {
            console.log(`  Processed ${count} games...`);
        }
    });

    console.log(`Total games exported: ${games.length}`);

    // Sort by date
    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    const outputPath = `exports/games_played_12m_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(games, null, 2));
    console.log(`Exported to ${outputPath}`);
    console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);

    process.exit(0);
}

exportGames().catch(e => { console.error(e); process.exit(1); });
