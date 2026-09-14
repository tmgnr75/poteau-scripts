/**
 * Keep `users.last_radius` in step with the radius of the user's active
 * availability (`users.last_availability`).
 *
 * THE INVARIANT
 * -------------
 * A player sets one search distance. It must mean the same thing everywhere:
 *
 *   availabilities.radius -> how far a game can be and still invite them
 *   users.last_radius     -> how far a game can be and still show in the feed
 *
 * These are two fields for one idea, and nothing keeps them together. When
 * they drift, the player is invited to games their own Games tab hides, which
 * is the worst of both: a notification for something they cannot find.
 *
 * games_widget.dart passes `currentUserDocument?.lastRadius` straight to
 * getGamesMulti with no fallback, which is why the drift is invisible until
 * someone opens the Games tab specifically. The availabilities banner DOES
 * prefer the availability (availabilities_banner_widget.dart:311), so the two
 * fields look interchangeable everywhere else.
 *
 * WHY IT MATTERED TODAY
 * ---------------------
 * Widening the Metz / Nancy corridor to 50 km (widen_radius_metz_nancy.js)
 * touched only `availabilities`, on the reasoning that `last_radius` is the
 * player's own visible setting. That left 525 players in the corridor invited
 * to games up to 50 km away while their feed still stopped at 20 km.
 *
 * Measured across the whole database on 2026-09-14: 104,601 users in sync,
 * 571 drifted, 536 of them with a feed NARROWER than their availability.
 *
 * DIRECTION MATTERS
 * -----------------
 * By default this only ever WIDENS the feed to match. Narrowing would remove
 * games a player can currently see, which is a real loss and not something to
 * do in a batch: 35 users have a feed wider than their availability, mostly
 * old 20 km feeds against a deliberately small 5 or 10 km availability.
 *
 * Pass --narrow to apply the invariant in both directions. Think before you
 * do: it takes games away.
 *
 * Idempotent either way.
 *
 * Run: node sync_last_radius_to_availability.js            (dry run, widen only)
 *      node sync_last_radius_to_availability.js --write
 *      node sync_last_radius_to_availability.js --narrow   (also shrink feeds)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const WRITE = process.argv.includes('--write');
const NARROW = process.argv.includes('--narrow');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

async function main() {
    console.log('\nSyncing users.last_radius to its last_availability radius');
    console.log(NARROW ? 'DIRECTION: widen AND narrow' : 'DIRECTION: widen only (use --narrow for both)');
    console.log(WRITE ? 'MODE: WRITE (this touches production)\n' : 'MODE: DRY RUN (nothing is written)\n');

    const availabilities = await db.collection('availabilities').get();
    const byId = new Map();
    availabilities.forEach((doc) => byId.set(doc.id, doc.data()));
    console.log(`Indexed ${byId.size} availability documents.`);

    const users = await db.collection('users').get();
    console.log(`Scanned ${users.size} users.`);

    const toUpdate = [];
    const shapes = {};
    let inSync = 0;
    let noActive = 0;
    let dangling = 0;
    let skippedNarrowing = 0;

    users.forEach((doc) => {
        const user = doc.data();
        // Pro accounts have no player feed.
        if (user.type === 'pro' || user.type === 'super_pro') return;

        const activeId = user.last_availability;
        if (!activeId) {
            noActive++;
            return;
        }
        const active = byId.get(activeId);
        if (!active) {
            // last_availability points at a document that no longer exists.
            // Left alone: guessing which availability replaced it would be
            // worse than leaving the feed as the player last saw it.
            dangling++;
            return;
        }

        const target = active.radius;
        if (typeof target !== 'number' || target <= 0) return;

        const current = user.last_radius;
        if (current === target) {
            inSync++;
            return;
        }

        const wouldNarrow = current !== undefined && current > target;
        if (wouldNarrow && !NARROW) {
            skippedNarrowing++;
            return;
        }

        const key = `${current === undefined ? 'unset' : current / 1000 + 'km'} -> ${target / 1000}km`;
        shapes[key] = (shapes[key] || 0) + 1;
        toUpdate.push({ ref: doc.ref, target });
    });

    console.log(`\n  already in sync            : ${inSync}`);
    console.log(`  no last_availability       : ${noActive}`);
    console.log(`  last_availability dangling : ${dangling}`);
    if (!NARROW) console.log(`  skipped (would narrow)     : ${skippedNarrowing}`);
    console.log(`  to change                  : ${toUpdate.length}`);

    console.log('\n  changes:');
    Object.entries(shapes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .forEach(([k, n]) => console.log(`    ${k}: ${n}`));

    if (!WRITE) {
        console.log('\n✅ Dry run complete, nothing written.');
        console.log('   Re-run with --write to apply.\n');
        process.exit(0);
    }

    let written = 0;
    for (let i = 0; i < toUpdate.length; i += 400) {
        const slice = toUpdate.slice(i, i + 400);
        const batch = db.batch();
        slice.forEach((u) => batch.update(u.ref, { last_radius: u.target }));
        await batch.commit();
        written += slice.length;
        console.log(`  committed ${written}/${toUpdate.length}`);
    }

    console.log(`\n✅ ${written} user(s) synced.\n`);
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
