const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// US detection signals (games has no reliable country field):
//  - time_zone starts with "America/" (Pacific/Honolulu too)
//  - country_code === 'US'
//  - address ends with USA / United States, or contains a ", XX <zip>" US state pattern
const US_TIMEZONES_PREFIX = ['America/', 'Pacific/Honolulu', 'Pacific/Pago_Pago', 'America/Anchorage'];
const US_STATES = new Set(['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']);

function isUsAddress(addr) {
    if (!addr) return false;
    const a = addr.trim();
    if (/,\s*USA\b/i.test(a) || /United States/i.test(a)) return true;
    // ", CA 90210" style: state abbrev + 5-digit zip near the end
    const m = a.match(/,\s*([A-Z]{2})\s+\d{5}(-\d{4})?/);
    if (m && US_STATES.has(m[1])) return true;
    return false;
}

function isUsGame(data) {
    const tz = data.time_zone || '';
    if (US_TIMEZONES_PREFIX.some(p => tz.startsWith(p))) return true;
    if (data.country_code === 'US') return true;
    if (isUsAddress(data.address)) return true;
    return false;
}

async function run() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const now = new Date();

    console.log(`Exporting played games ${sixMonthsAgo.toISOString().split('T')[0]} -> ${now.toISOString().split('T')[0]}...`);

    const snapshot = await db.collection('games')
        .where('status', '==', 'played')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(sixMonthsAgo))
        .where('date', '<=', admin.firestore.Timestamp.fromDate(now))
        .get();

    console.log(`Total played games in window: ${snapshot.size}`);

    const games = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (!isUsGame(data)) return;

        let attendeeCount = 0;
        const attendeeIds = [];
        if (Array.isArray(data.attendees)) {
            data.attendees.forEach(a => {
                if (a instanceof admin.firestore.DocumentReference) {
                    attendeeCount++;
                    const uid = a.path.split('/')[1];
                    if (!attendeeIds.includes(uid)) attendeeIds.push(uid);
                }
            });
        }
        let outsiderCount = 0;
        if (Array.isArray(data.outsiders)) outsiderCount = data.outsiders.length;

        games.push({
            id: doc.id,
            date: data.date?.toDate().toISOString() || null,
            centre: data.centre || null,
            place_id: data.place_id || null,
            address: data.address || null,
            reservation_name: data.reservation_name || null,
            sport: data.sport || null,
            type: data.type || null,
            organizer: data.organizer || null,
            max_players: data.max_players || null,
            attendee_count: attendeeCount,
            unique_attendee_count: attendeeIds.length,
            attendee_ids: attendeeIds,
            outsider_count: outsiderCount,
            duration: data.duration || null,
            price: data.price || null,
            currency: data.currency || null,
            payment_type: data.payment_type || null,
            country_code: data.country_code || null,
            time_zone: data.time_zone || null,
            gold_exclusive: data.gold_exclusive || false,
            has_repeater: !!data.repeater,
        });
    });

    console.log(`US games matched: ${games.length}`);
    games.sort((a, b) => new Date(a.date) - new Date(b.date));

    const outputPath = `exports/us_games_6m_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(games, null, 2));
    console.log(`Exported to ${outputPath} (${(fs.statSync(outputPath).size/1024).toFixed(1)} KB)`);
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
