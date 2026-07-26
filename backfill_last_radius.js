/**
 * Backfill `last_radius` for player accounts where it was never set.
 *
 * Context: the onboarding GPS path (3_onboarding/e_area) wrote the default
 * radius onto the availabilities doc but never onto the user doc, so users who
 * granted location permission and never touched the radius slider ended up with
 * `last_radius` unset. The Dart getter coalesces that to 0, the client sends
 * distance: 0 to getGamesMulti, and the games feed came back empty.
 *
 * Mirrors defaultDistance() in poteau-app/lib/custom_code/functions/default_distance.dart:
 *   distance_unit == "mi" -> 16093 (10mi), otherwise 20000 (20km).
 *
 * Usage:
 *   node backfill_last_radius.js            # dry run, writes nothing
 *   node backfill_last_radius.js --apply    # performs the writes
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
const PAGE_SIZE = 2000;
const BATCH_SIZE = 500;
const DEFAULT_RADIUS_KM_M = 20000; // 20km
const DEFAULT_RADIUS_MI_M = 16093; // 10mi

function defaultDistance(distanceUnit) {
    const unit = !distanceUnit ? 'km' : distanceUnit;
    return unit === 'mi' ? DEFAULT_RADIUS_MI_M : DEFAULT_RADIUS_KM_M;
}

(async () => {
    console.log(APPLY ? '=== APPLY MODE: writes enabled ===' : '=== DRY RUN: no writes ===');

    let cursor = null;
    let scanned = 0;
    let skippedPro = 0;
    let alreadySet = 0;
    let toUpdate = 0;
    let written = 0;
    const byUnit = {};

    let batch = db.batch();
    let pending = 0;

    while (true) {
        let q = db.collection('users')
            .select('last_radius', 'type', 'distance_unit')
            .orderBy('__name__')
            .limit(PAGE_SIZE);
        if (cursor) q = q.startAfter(cursor);

        const snap = await q.get();
        if (snap.empty) break;

        for (const doc of snap.docs) {
            scanned++;
            const d = doc.data();

            // Pro/super_pro accounts don't use the player games feed.
            if (d.type === 'pro' || d.type === 'super_pro') {
                skippedPro++;
                continue;
            }

            const r = d.last_radius;
            if (r !== undefined && r !== null && r !== 0) {
                alreadySet++;
                continue;
            }

            const radius = defaultDistance(d.distance_unit);
            byUnit[d.distance_unit || '(unset)'] = (byUnit[d.distance_unit || '(unset)'] || 0) + 1;
            toUpdate++;

            if (APPLY) {
                batch.update(doc.ref, { last_radius: radius });
                pending++;
                if (pending >= BATCH_SIZE) {
                    await batch.commit();
                    written += pending;
                    console.log(`  committed ${written}...`);
                    batch = db.batch();
                    pending = 0;
                }
            }
        }

        cursor = snap.docs[snap.docs.length - 1];
        if (snap.size < PAGE_SIZE) break;
    }

    if (APPLY && pending > 0) {
        await batch.commit();
        written += pending;
    }

    console.log('');
    console.log(`scanned users:        ${scanned}`);
    console.log(`skipped (pro):        ${skippedPro}`);
    console.log(`already set:          ${alreadySet}`);
    console.log(`needing backfill:     ${toUpdate}`);
    console.log(`  by distance_unit:   ${JSON.stringify(byUnit)}`);
    console.log(`actually written:     ${APPLY ? written : 0}`);
    if (!APPLY) console.log('\nRe-run with --apply to perform the writes.');

    process.exit(0);
})().catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
});
