/**
 * Widen the availability search radius to 50 km across the Metz / Nancy corridor.
 *
 * WHY
 * ---
 * The corridor is one travel area in practice, and 20 km does not cover it.
 * Metz to Nancy is 50 km; Pont-a-Mousson sits between them, and a player in
 * either city is a realistic player for a pitch in the middle.
 *
 * The 20 km default cuts that corridor in half, and the failure is invisible
 * to the person it affects: on 2026-09-14 a centre owner published two games
 * at his own venue and could not see them in the player app. His search was
 * centred on Metz, 20.54 km from the pitch, with a 20 km radius. He missed his
 * own games by 539 metres and reported it as a bug.
 *
 * He is not a special case, he is the visible one. The same 539 metres are
 * silently removing the same games from every player in the area.
 *
 * WHAT IT CHANGES
 * ---------------
 * Every `availabilities` document whose location falls within ZONE_RADIUS_KM
 * of the corridor centre and whose radius is below 50 km is raised to 50 km.
 * Documents already at 50 km or more are left alone.
 *
 * `radius` is stored in METRES, not kilometres. Read as kilometres it matches
 * every document in the collection, which is an easy and expensive mistake:
 * 20000 is 20 km, not 20000 km.
 *
 * WHAT IT DOES NOT DO
 * -------------------
 * It does not target any individual. The rule is geographic and applies to
 * everyone in the zone; whether a particular account benefits is a consequence,
 * checked afterwards, never an input.
 *
 * It also does not touch `users.last_radius`, which drives the games feed
 * directly. That is a separate field with a separate effect, and widening it
 * silently would change what people see without them asking. See the note at
 * the bottom of this file.
 *
 * Idempotent: re-running changes nothing once applied.
 *
 * Run: node widen_radius_metz_nancy.js          (dry run, writes nothing)
 *      node widen_radius_metz_nancy.js --write
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const WRITE = process.argv.includes('--write');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

// Centre of the corridor, between Metz and Nancy.
const ZONE = { lat: 48.9379, lng: 6.1123, name: 'Metz / Nancy corridor' };

// How far around that centre the rule applies. 50 km reaches Metz, Nancy and
// Thionville, which is the travel area players actually treat as local.
const ZONE_RADIUS_KM = 50;

// The new floor, in metres. Documents at or above this are untouched.
const TARGET_RADIUS_M = 50000;

function distanceKm(lat, lng) {
    const R = 6371;
    const dLat = ((lat - ZONE.lat) * Math.PI) / 180;
    const dLng = ((lng - ZONE.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((ZONE.lat * Math.PI) / 180) *
            Math.cos((lat * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
    console.log(`\nWidening availability radius to ${TARGET_RADIUS_M / 1000} km`);
    console.log(`Zone: within ${ZONE_RADIUS_KM} km of the ${ZONE.name}`);
    console.log(WRITE ? 'MODE: WRITE (this touches production)\n' : 'MODE: DRY RUN (nothing is written)\n');

    const snapshot = await db.collection('availabilities').get();
    console.log(`Scanned ${snapshot.size} availability documents.`);

    const toUpdate = [];
    const byCity = {};
    let inZone = 0;
    let alreadyWide = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        const location = data.location;
        if (!location || location.latitude == null) return;
        if (distanceKm(location.latitude, location.longitude) > ZONE_RADIUS_KM) return;

        inZone++;

        const radius = typeof data.radius === 'number' ? data.radius : null;
        if (radius !== null && radius >= TARGET_RADIUS_M) {
            alreadyWide++;
            return;
        }

        toUpdate.push({ ref: doc.ref, id: doc.id, from: radius, city: data.city || '(unknown)' });
        byCity[data.city || '(unknown)'] = (byCity[data.city || '(unknown)'] || 0) + 1;
    });

    console.log(`  in zone            : ${inZone}`);
    console.log(`  already >= ${TARGET_RADIUS_M / 1000} km : ${alreadyWide}`);
    console.log(`  to widen           : ${toUpdate.length}`);

    const users = new Set(toUpdate.map((u) => u.id.split('_')[0]));
    console.log(`  distinct users     : ${users.size}`);

    console.log('\n  by city:');
    Object.entries(byCity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([city, n]) => console.log(`    ${city}: ${n}`));

    const fromCounts = {};
    toUpdate.forEach((u) => {
        const key = u.from === null ? 'unset' : `${u.from / 1000} km`;
        fromCounts[key] = (fromCounts[key] || 0) + 1;
    });
    console.log('\n  current radius values being replaced:');
    Object.entries(fromCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([k, n]) => console.log(`    ${k}: ${n}`));

    if (!WRITE) {
        console.log('\n✅ Dry run complete, nothing written.');
        console.log('   Re-run with --write to apply.\n');
        process.exit(0);
    }

    // Batched, 400 at a time: the Firestore limit is 500 writes per batch.
    let written = 0;
    for (let i = 0; i < toUpdate.length; i += 400) {
        const chunk = toUpdate.slice(i, i + 400);
        const batch = db.batch();
        chunk.forEach((u) => {
            batch.update(u.ref, {
                radius: TARGET_RADIUS_M,
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
        written += chunk.length;
        console.log(`  committed ${written}/${toUpdate.length}`);
    }

    console.log(`\n✅ ${written} availability documents widened to ${TARGET_RADIUS_M / 1000} km.\n`);
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});

/**
 * A NOTE ON users.last_radius
 * ---------------------------
 * The games feed (getGamesMulti) reads `users.last_radius`, NOT this
 * collection. Widening availabilities changes who gets invited and matched;
 * it does not change what a player sees when they open the Games tab.
 *
 * That field is left alone here on purpose: it is the player's own current
 * filter setting, visible in the app, and rewriting it would silently change
 * their search without them touching anything. A player who wants to see
 * further changes it themselves in one tap.
 */
