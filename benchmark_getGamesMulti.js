const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const moment = require('moment-timezone');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

// Replicate the exact Firestore query from getGamesMulti.js for a given (date, timezone).
// Measure: docs scanned by Firestore (= snapshot.size), games matching each post-filter.
async function runOne({ label, date, sport, centerLat, centerLng, radiusMeters, timeZone }) {
    const now = new Date();
    let start, end;

    if (date === moment.tz(now, timeZone).format('YYYY-MM-DD')) {
        const thirtyMinutesAgo = moment.tz(now, timeZone).subtract(30, 'minutes');
        const tomorrow = moment.tz(now, timeZone).add(1, 'day').startOf('day').add(2, 'hours');
        start = thirtyMinutesAgo.clone().utc().toDate();
        end = tomorrow.clone().utc().toDate();
    } else {
        start = moment.tz(date, timeZone).startOf('day').clone().utc().toDate();
        end = moment.tz(date, timeZone).endOf('day').clone().utc().toDate();
    }

    const t0 = Date.now();
    const snapshot = await db.collection('games')
        .where('date', '>', start)
        .where('date', '<=', end)
        .where('status', '==', 'published')
        .select(
            'date', 'location', 'attendees', 'organizer', 'teams', 'centre',
            'max_players', 'price', 'price_undiscounted', 'gold_exclusive',
            'visibility', 'duration', 'place_id', 'currency', 'payment_type', 'sport'
        )
        .get();
    const elapsedMs = Date.now() - t0;

    const docsScanned = snapshot.size;

    let afterSportFilter = 0;
    let afterDistanceFilter = 0;
    const sportCounts = { soccer: 0, padel: 0, other: 0, unset: 0 };
    const cities = {};

    snapshot.forEach(doc => {
        const g = doc.data();
        const gSport = g.sport || 'soccer';
        if (g.sport === undefined) sportCounts.unset++;
        if (gSport === 'soccer') sportCounts.soccer++;
        else if (gSport === 'padel') sportCounts.padel++;
        else sportCounts.other++;

        if (gSport !== sport) return;
        afterSportFilter++;

        if (!g.location || !g.location.latitude || !g.location.longitude) return;
        const dist = haversine(centerLat, centerLng, g.location.latitude, g.location.longitude);
        if (dist <= radiusMeters) afterDistanceFilter++;

        // Coarse "city" label by 0.5° buckets for diagnostic
        const cityKey = `${Math.round(g.location.latitude * 2) / 2},${Math.round(g.location.longitude * 2) / 2}`;
        cities[cityKey] = (cities[cityKey] || 0) + 1;
    });

    const topCities = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
        label,
        date,
        sport,
        docsScanned,
        afterSportFilter,
        afterDistanceFilter,
        sportCounts,
        topCities,
        elapsedMs,
    };
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
    const PARIS = { lat: 48.8566, lng: 2.3522, tz: 'Europe/Paris' };
    const RADIUS = 30000;

    const today = moment.tz(PARIS.tz).format('YYYY-MM-DD');
    const dates = [];
    for (let offset = -1; offset <= 7; offset++) {
        dates.push(moment.tz(PARIS.tz).add(offset, 'days').format('YYYY-MM-DD'));
    }

    console.log(`\n=== getGamesMulti benchmark ===`);
    console.log(`Center: Paris (${PARIS.lat}, ${PARIS.lng}) | Radius: ${RADIUS/1000}km | TZ: ${PARIS.tz}`);
    console.log(`Today: ${today}\n`);

    const results = [];
    for (const date of dates) {
        for (const sport of ['soccer', 'padel']) {
            const r = await runOne({
                label: `${date} ${sport}`,
                date, sport,
                centerLat: PARIS.lat, centerLng: PARIS.lng,
                radiusMeters: RADIUS, timeZone: PARIS.tz,
            });
            results.push(r);
        }
    }

    // Summary table
    console.log('Date        Sport   | Scanned | AfterSport | AfterDist | soccer/padel/unset | ms');
    console.log('------------+-------+---------+------------+-----------+---------------------+------');
    for (const r of results) {
        const c = r.sportCounts;
        console.log(
            `${r.date}  ${r.sport.padEnd(6)} | ${String(r.docsScanned).padStart(7)} | ${String(r.afterSportFilter).padStart(10)} | ${String(r.afterDistanceFilter).padStart(9)} | ${String(c.soccer).padStart(6)}/${String(c.padel).padStart(5)}/${String(c.unset).padStart(5)} | ${r.elapsedMs}`
        );
    }

    // Aggregates
    const totalScanned = results.reduce((s, r) => s + r.docsScanned, 0);
    const totalAfterSport = results.reduce((s, r) => s + r.afterSportFilter, 0);
    const totalAfterDist = results.reduce((s, r) => s + r.afterDistanceFilter, 0);
    console.log('\n=== Aggregates across all runs ===');
    console.log(`Total docs scanned: ${totalScanned}`);
    console.log(`After sport filter: ${totalAfterSport} (${((totalAfterSport/totalScanned)*100).toFixed(1)}%)`);
    console.log(`After distance filter (Paris 30km): ${totalAfterDist} (${((totalAfterDist/totalScanned)*100).toFixed(1)}%)`);

    // Paris-only geographic concentration (for today only)
    console.log('\n=== Geographic concentration (today, soccer) ===');
    const todaySoccer = results.find(r => r.date === today && r.sport === 'soccer');
    if (todaySoccer) {
        console.log(`Top 5 "cities" (0.5° buckets) for today's soccer games:`);
        todaySoccer.topCities.forEach(([key, count]) => {
            console.log(`  ${key}: ${count} games`);
        });
    }

    // Simulate the REAL cost per query (what the app pays)
    console.log('\n=== Projected reads per call ===');
    console.log(`Firestore charges by docs returned by the query, BEFORE app-level filtering.`);
    console.log(`So each call currently scans ~${Math.round(totalScanned / results.length)} docs on average.`);

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
