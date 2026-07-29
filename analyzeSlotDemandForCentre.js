/**
 * Find the best slots to open at a given centre, using the real invitation
 * mechanism as the model.
 *
 * Since the FootPower5-era change, a published game invites players by matching
 * the `availabilities` collection (mirrored into Algolia) against the game's
 * day-of-week + time. This script replicates that matching EXACTLY, reading
 * from Firestore rather than Algolia, so it predicts how many players would
 * actually be invited if the centre opened a given slot.
 *
 * Matching rules replicated from cloud-functions/functions/gen2/onGamePublished.js
 * and shared/availabilityMatching.js:
 *
 *   - Slot format `<weekday>-<HH:MM>`, weekday 1..7 (Monday=1), 30-minute grid.
 *   - A game at time T matches every slot anchor within ±20 minutes
 *     (SLOT_WINDOW_MINUTES), so 19:00 matches only "19:00", but 19:20 matches
 *     both "19:00" and "19:30".
 *   - Algolia pre-filters to SEARCH_RADIUS_M (50km) around the game.
 *   - Then EACH availability is kept only if its OWN `radius` reaches the game
 *     (haversine distance <= that user's radius). Default 20km when unset.
 *     This per-user radius filter is the key detail: a user 18km away with a
 *     10km radius is NOT invited.
 *   - One user may hold several availability docs; users are deduped.
 *
 * Usage:
 *   node analyzeSlotDemandForCentre.js --uid=<pro user id>
 *   node analyzeSlotDemandForCentre.js --lat=43.61 --lng=5.30 --name="Centre"
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

// Mirrors gen2/onGamePublished.js
const SEARCH_RADIUS_M = 50000;
const DEFAULT_USER_RADIUS_M = 20000;
const SLOT_WINDOW_MINUTES = 20;

const WEEKDAYS = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi', 7: 'Dimanche' };

function haversineMeters(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// Mirrors shared/availabilityMatching.js buildCandidateSlots()
function buildCandidateSlots(weekday, hours, minutes) {
    const gameMinutes = hours * 60 + minutes;
    const out = [];
    const floorAnchor = Math.floor(gameMinutes / 30) * 30;
    for (const anchor of [floorAnchor - 30, floorAnchor, floorAnchor + 30]) {
        if (anchor < 0 || anchor >= 24 * 60) continue;
        if (Math.abs(anchor - gameMinutes) > SLOT_WINDOW_MINUTES) continue;
        const h = String(Math.floor(anchor / 60)).padStart(2, '0');
        const m = String(anchor % 60).padStart(2, '0');
        out.push(`${weekday}-${h}:${m}`);
    }
    return out;
}

async function main() {
    const args = process.argv.slice(2);
    const get = (k) => {
        const a = args.find((x) => x.startsWith(`--${k}=`));
        return a ? a.split('=').slice(1).join('=') : null;
    };

    let lat, lng, centreName;
    const uid = get('uid');

    if (uid) {
        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) throw new Error(`User ${uid} not found`);
        const u = snap.data();
        if (!u.centre_location) throw new Error('User has no centre_location');
        lat = u.centre_location.latitude;
        lng = u.centre_location.longitude;
        centreName = u.centre_name || u.display_name;
    } else {
        lat = parseFloat(get('lat'));
        lng = parseFloat(get('lng'));
        centreName = get('name') || 'centre';
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        console.log('Usage: node analyzeSlotDemandForCentre.js --uid=<proUid>');
        console.log('   or: node analyzeSlotDemandForCentre.js --lat=.. --lng=.. --name=".."');
        process.exit(1);
    }

    console.log(`\n=== Slot demand for ${centreName} (${lat}, ${lng}) ===`);
    console.log(`Replicating onGamePublished matching: ${SEARCH_RADIUS_M / 1000}km prefilter, per-user radius, ±${SLOT_WINDOW_MINUTES}min window\n`);

    const snap = await db.collection('availabilities').get();
    console.log(`availabilities scanned: ${snap.size}`);

    // Keep only docs whose own radius reaches this centre, exactly as the
    // Cloud Function does after the Algolia prefilter.
    const reaching = [];
    let inPrefilter = 0;
    snap.docs.forEach((doc) => {
        const a = doc.data();
        if (!a.location || a.location.latitude == null) return;
        const dist = haversineMeters(a.location.latitude, a.location.longitude, lat, lng);
        if (dist > SEARCH_RADIUS_M) return;
        inPrefilter++;
        const userRadius = typeof a.radius === 'number' ? a.radius : DEFAULT_USER_RADIUS_M;
        if (dist > userRadius) return;
        reaching.push({ userId: a.user_id, slots: a.slots || [], dist, city: a.city });
    });

    console.log(`within ${SEARCH_RADIUS_M / 1000}km prefilter : ${inPrefilter}`);
    console.log(`whose OWN radius reaches centre: ${reaching.length}`);
    const uniqueUsers = new Set(reaching.map((r) => r.userId));
    console.log(`unique users reachable         : ${uniqueUsers.size}\n`);

    // For every 30-min anchor in the grid, count how many DISTINCT users would
    // be invited to a game starting exactly at that anchor.
    const slotUsers = {};
    reaching.forEach((r) => {
        r.slots.forEach((s) => {
            (slotUsers[s] = slotUsers[s] || new Set()).add(r.userId);
        });
    });

    const rows = Object.entries(slotUsers)
        .map(([slot, users]) => {
            const [wd, time] = slot.split('-');
            return { slot, weekday: parseInt(wd, 10), time, users: users.size };
        })
        .filter((r) => r.weekday >= 1 && r.weekday <= 7)
        .sort((a, b) => b.users - a.users);

    console.log('=== TOP 25 SLOTS by number of players who would be invited ===');
    console.log('(a game starting exactly at this time invites this many distinct users)\n');
    rows.slice(0, 25).forEach((r, i) => {
        console.log(
            `${String(i + 1).padStart(3)}. ${WEEKDAYS[r.weekday].padEnd(9)} ${r.time}   ${String(r.users).padStart(4)} joueurs`
        );
    });

    // Evening-only view: the slots a centre would realistically open.
    console.log('\n=== BEST EVENING SLOT PER WEEKDAY (17:00-22:00) ===');
    for (let wd = 1; wd <= 7; wd++) {
        const best = rows
            .filter((r) => r.weekday === wd)
            .filter((r) => {
                const h = parseInt(r.time.split(':')[0], 10);
                return h >= 17 && h <= 22;
            })
            .sort((a, b) => b.users - a.users)
            .slice(0, 3);
        if (best.length) {
            console.log(
                `  ${WEEKDAYS[wd].padEnd(9)} ` +
                    best.map((b) => `${b.time} (${b.users})`).join('   ')
            );
        }
    }

    console.log('\n=== city spread of reachable users ===');
    const cities = {};
    reaching.forEach((r) => (cities[r.city || '?'] = (cities[r.city || '?'] || 0) + 1));
    Object.entries(cities)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12)
        .forEach(([c, n]) => console.log(`  ${String(n).padStart(4)}  ${c}`));

    process.exit(0);
}

main().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
