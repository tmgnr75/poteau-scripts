/**
 * Seed N past `played` games for a test account, mirroring the shape of a real
 * high-volume user (Hassan, 33 soccer games at LE FIVE-style centres).
 *
 * Purpose: reproduce the "played games don't appear on my profile" report.
 * The paged list uses pageSize 10, so a single-page user (1 game) can look
 * fine while a multi-page user (33 games) does not. This seeds the multi-page
 * case so the sim can show whether the list actually renders.
 *
 * Games are Kinshasa-anchored and flagged is_test_game:true for isolation.
 *
 * With --mixed, a share of the games are seeded as `published` (game happened
 * but never reached max_players, so the transition job never marked it played)
 * and `canceled`/`hidden`. That exercises the profile's "see all my games"
 * toggle and its per-status badges, which are invisible in an all-played set.
 *
 * Usage:
 *   node seed_played_games.js <rosterKey> [--count 33] [--live] [--clean]
 *   node seed_played_games.js <rosterKey> --count 38 --mixed --live
 */
const admin = require('firebase-admin');
const path = require('path');
const { KINSHASA, ROSTER, emailFor } = require('./kinshasa_test_config.js');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            require(path.join(__dirname, '../../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'))
        ),
        projectId: 'krank-club'
    });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const rosterKey = args.find(a => !a.startsWith('--')) || 'sophie_joiner';
const LIVE = args.includes('--live');
const CLEAN = args.includes('--clean');
const countArg = args.indexOf('--count');
const COUNT = countArg >= 0 ? parseInt(args[countArg + 1], 10) : 33;
const MIXED = args.includes('--mixed');

/**
 * Status for the i-th seeded game.
 *
 * Roughly mirrors Hassan's real profile (33 played / 4 published / 1 canceled):
 * mostly played, with a scattering of the two non-played cases so both badges
 * and the faded-card treatment show up in the first page of the list.
 */
function statusFor(i) {
    if (!MIXED) return 'played';
    if (i % 7 === 1) return 'published';   // "Non confirmé"
    if (i % 11 === 3) return 'canceled';   // "Annulé"
    if (i % 17 === 5) return 'hidden';     // also renders as "Annulé"
    return 'played';
}

async function main() {
    const entry = ROSTER.find(r => r.key === rosterKey);
    if (!entry) throw new Error(`Unknown roster key: ${rosterKey}`);

    // The roster carries no UIDs; resolve via the account's email.
    const email = emailFor(rosterKey);
    const authUser = await admin.auth().getUserByEmail(email);
    const uid = authUser.uid;
    const userRef = db.doc(`users/${uid}`);

    console.log(LIVE ? '=== LIVE ===' : '=== DRY RUN (use --live to write) ===');
    console.log(`persona: ${rosterKey} (${uid})`);

    // Remove previously seeded games so runs are repeatable. Not filtered on
    // status: --mixed seeds published/canceled/hidden too, and a status-scoped
    // sweep would leave those behind to pile up across runs.
    const existing = await db.collection('games')
        .where('attendees', 'array-contains', userRef)
        .get();
    console.log(`existing games for persona: ${existing.size}`);

    if (CLEAN || existing.size > 0) {
        const seeded = existing.docs.filter(d => d.data().is_test_game === true);
        console.log(`  of which seeded (is_test_game): ${seeded.length}`);
        if (LIVE && seeded.length) {
            let b = db.batch();
            seeded.forEach(d => b.delete(d.ref));
            await b.commit();
            console.log(`  deleted ${seeded.length} previously seeded games`);
        }
        if (CLEAN) {
            console.log('clean-only mode, exiting');
            return;
        }
    }

    // Build COUNT past games, most recent ~3 days ago, spaced ~10 days apart.
    const now = Date.now();
    const docs = [];
    for (let i = 0; i < COUNT; i++) {
        const date = new Date(now - (3 + i * 10) * 24 * 3600 * 1000);
        date.setUTCHours(18, 30, 0, 0);
        const end = new Date(date.getTime() + 90 * 60 * 1000);
        docs.push({
            address: `${10 + i} Avenue du Test, Kinshasa`,
            centre: `Kinshasa Test Arena ${(i % 4) + 1}`,
            date: admin.firestore.Timestamp.fromDate(date),
            end_time: admin.firestore.Timestamp.fromDate(end),
            created_on: admin.firestore.Timestamp.fromDate(new Date(date.getTime() - 7 * 24 * 3600 * 1000)),
            duration: 90,
            max_players: 10,
            price: 8,
            price_undiscounted: 8,
            currency: 'EUR',
            payment_type: 'on-site',
            sport: 'soccer',
            status: statusFor(i),
            type: 'pro',
            time_zone: KINSHASA.timeZone,
            country_code: KINSHASA.countryCode,
            place_id: KINSHASA.placeId,
            location: new admin.firestore.GeoPoint(KINSHASA.lat, KINSHASA.lng),
            gold_exclusive: false,
            organizer: uid,
            attendees: [userRef],
            interested: [],
            teams: [],
            late_players: [],
            no_show_players: [],
            rude_players: [],
            good_players: [],
            is_test_game: true,
        });
    }

    console.log(`\nwould create ${docs.length} played games`);
    console.log(`  newest: ${docs[0].date.toDate().toISOString()}`);
    console.log(`  oldest: ${docs[docs.length - 1].date.toDate().toISOString()}`);

    if (!LIVE) {
        console.log('\nDRY RUN — nothing written.');
        return;
    }

    let batch = db.batch();
    let n = 0;
    for (const d of docs) {
        batch.set(db.collection('games').doc(), d);
        if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
    }
    await batch.commit();
    console.log(`\ncreated ${docs.length} games`);

    const verify = await db.collection('games')
        .where('attendees', 'array-contains', userRef)
        .get();
    const byStatus = {};
    verify.forEach(d => {
        const s = d.data().status || '(none)';
        byStatus[s] = (byStatus[s] || 0) + 1;
    });
    console.log(`verified games for persona: ${verify.size}`);
    Object.entries(byStatus)
        .sort((a, b) => b[1] - a[1])
        .forEach(([s, n]) => console.log(`  ${s}: ${n}`));

    // What the profile should show: the header count in each state.
    const played = byStatus.played || 0;
    console.log(`\nprofile expectation: default "${played} matchs joués", toggled "${verify.size} matchs"`);
}

main().then(() => process.exit(0)).catch(e => { console.error('ERROR', e); process.exit(1); });
