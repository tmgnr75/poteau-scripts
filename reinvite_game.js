/**
 * Re-run availability matching on a game that already exists, and create the
 * invitations it would get today.
 *
 * WHY THIS EXISTS
 * ---------------
 * Invitations are created once, at the moment a game is published
 * (onGamePublished) or four days before kickoff (scheduleProInvites). Nothing
 * re-runs them. So when the inputs change AFTER that moment, the game keeps the
 * invitation list it happened to get, forever.
 *
 * That bit on 2026-09-14: the Metz / Nancy availability radius was widened from
 * 20 km to 50 km (widen_radius_metz_nancy.js), which took the pool around a
 * Pont-a-Mousson venue from 7 matching players to 112. The two games already
 * published there kept their original 7 and 0 invitations, because the only two
 * code paths that invite had already run.
 *
 * WHAT IT DOES
 * ------------
 * Exactly what gen2/onGamePublished.js does, in the same order and with the
 * same helpers, against a game that is already published:
 *
 *   1. builds the candidate slots for the game's weekday + time
 *   2. queries the Algolia `availabilities` index within a 50 km prefilter
 *   3. filters every hit by that user's OWN radius (the prefilter is wide on
 *      purpose; the per-user radius is the real rule)
 *   4. excludes the organizer, attendees and interested users
 *   5. calls the shared createInvitationsForGame, which itself skips anyone
 *      already invited
 *
 * Because step 5 deduplicates, re-running is safe: already-invited players are
 * not invited twice and get no second push.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not bypass the per-user radius, and it does not widen the search to
 * "everyone nearby". A player who set a 10 km radius has said how far they are
 * willing to travel, and a re-run is not a reason to override that.
 *
 * CREDENTIALS
 *   ALGOLIA_ADMIN_KEY must be in the environment. The service account cannot
 *   read Secret Manager, so take it from the Firebase CLI instead:
 *     export ALGOLIA_ADMIN_KEY=$(cd ../cloud-functions && \
 *       firebase functions:secrets:access ALGOLIA_ADMIN_KEY --project=krank-club)
 *
 * Run:
 *   node reinvite_game.js --game <id> [--game <id>]        dry run
 *   node reinvite_game.js --game <id> --write              create invitations
 */

const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const FUNCTIONS = path.join(__dirname, '..', 'cloud-functions', 'functions');

// firebase-admin is loaded from cloud-functions/functions, NOT from scripts/.
//
// The shared helpers below build their DocumentReferences with that copy of
// the SDK. A reference created by a different copy is rejected at write time
// with "Detected an object of type DocumentReference that doesn't match the
// expected instance", because Firestore compares constructor identity, not
// shape. Two installs of the same version are still two different classes.
const admin = require(path.join(FUNCTIONS, 'node_modules', 'firebase-admin'));

// Initialize BEFORE requiring the shared helpers. They pull in gen2/admin,
// which calls initializeApp() with no arguments the moment it is loaded --
// fine inside Cloud Functions, where credentials come from the runtime, but
// here it would claim the default app with no service account and every read
// would fail. Claiming it first with explicit credentials makes gen2/admin's
// `if (!admin.apps.length)` a no-op.
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const { buildCandidateSlots } = require(path.join(FUNCTIONS, 'shared', 'availabilityMatching'));
const { haversineDistance } = require(path.join(FUNCTIONS, 'shared', 'haversine'));
const { getAvailabilitiesIndex } = require(path.join(FUNCTIONS, 'shared', 'algoliaClient'));
const { createInvitationsForGame, excludedUserIds } = require(path.join(FUNCTIONS, 'shared', 'inviteCreation'));

const geoTz = require(path.join(FUNCTIONS, 'node_modules', 'geo-tz'));
const moment = require(path.join(FUNCTIONS, 'node_modules', 'moment-timezone'));

// Same constants as onGamePublished.js. The prefilter is wide; the per-user
// radius below is what actually decides.
const SEARCH_RADIUS_M = 50000;
const DEFAULT_USER_RADIUS_M = 20000;

const WRITE = process.argv.includes('--write');

function gameIds() {
    const ids = [];
    process.argv.forEach((arg, i) => {
        if (arg === '--game' && process.argv[i + 1]) ids.push(process.argv[i + 1]);
    });
    return ids;
}

const db = admin.firestore();

async function reinvite(gameId, index) {
    const ref = db.collection('games').doc(gameId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`games/${gameId} does not exist.`);

    const game = snap.data();
    const when = game.date.toDate();
    console.log(`\n=== ${gameId} ===`);
    console.log(`  ${when.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} | ${game.centre}`);
    console.log(`  status=${game.status} | ${(game.attendees || []).length}/${game.max_players} players`);

    // The same guards onGamePublished applies. A re-run must not invite people
    // to a game they cannot join.
    if (game.status !== 'published') {
        console.log('  SKIP: not published.');
        return 0;
    }
    if (game.visibility === 'private') {
        console.log('  SKIP: private.');
        return 0;
    }
    const attendeesCount = Array.isArray(game.attendees) ? game.attendees.length : 0;
    if (game.max_players != null && attendeesCount >= game.max_players) {
        console.log(`  SKIP: full (${attendeesCount}/${game.max_players}).`);
        return 0;
    }
    if (when.getTime() < Date.now()) {
        console.log('  SKIP: already in the past.');
        return 0;
    }
    if (!game.location || game.location.latitude == null) {
        console.log('  SKIP: no location.');
        return 0;
    }

    const lat = game.location.latitude;
    const lng = game.location.longitude;
    const zones = geoTz.find(lat, lng);
    const timeZone = zones.length > 0 ? zones[0] : 'Europe/Paris';
    const local = moment(when).tz(timeZone);
    const dayOfWeek = local.day() === 0 ? 7 : local.day();

    const candidateSlots = buildCandidateSlots(dayOfWeek, local.hour(), local.minute());
    console.log(`  slots: ${candidateSlots.join(', ') || '(none)'}`);
    if (candidateSlots.length === 0) {
        console.log('  SKIP: no candidate slots.');
        return 0;
    }

    const excluded = excludedUserIds(game);
    console.log(`  excluding ${excluded.size} user(s) already tied to this game`);

    const searchParams = {
        aroundLatLng: `${lat},${lng}`,
        aroundRadius: SEARCH_RADIUS_M,
        facetFilters: [candidateSlots.map((s) => `slots:${s}`)],
        hitsPerPage: 1000,
        attributesToRetrieve: ['user_id', '_geoloc', 'radius'],
    };

    const firstPage = await index.search('', { ...searchParams, page: 0 });
    const hits = [...firstPage.hits];
    if (firstPage.nbPages > 1) {
        const rest = await Promise.all(
            Array.from({ length: firstPage.nbPages - 1 }, (_, i) =>
                index.search('', { ...searchParams, page: i + 1 })
            )
        );
        rest.forEach((r) => hits.push(...r.hits));
    }
    console.log(`  Algolia: ${hits.length} slot-matched availabilities within ${SEARCH_RADIUS_M / 1000}km`);

    // Each availability carries its own radius. The prefilter above is only a
    // cheap bound; this is the rule that counts.
    const userToAvailability = new Map();
    for (const hit of hits) {
        if (!hit.user_id || excluded.has(hit.user_id)) continue;
        if (!hit._geoloc) continue;
        const userRadius = typeof hit.radius === 'number' ? hit.radius : DEFAULT_USER_RADIUS_M;
        if (haversineDistance(hit._geoloc.lat, hit._geoloc.lng, lat, lng) > userRadius) continue;
        if (!userToAvailability.has(hit.user_id)) userToAvailability.set(hit.user_id, hit.objectID);
    }
    console.log(`  after per-user radius filter: ${userToAvailability.size} users`);

    const existing = await db.collection('game_invitations').where('game', '==', ref).get();
    console.log(`  invitations already on this game: ${existing.size}`);

    if (userToAvailability.size === 0) {
        console.log('  nothing to do.');
        return 0;
    }

    if (!WRITE) {
        console.log(`  WOULD invite up to ${userToAvailability.size} users (already-invited are skipped downstream).`);
        return 0;
    }

    const created = await createInvitationsForGame(ref, userToAvailability, game.date);
    console.log(`  created ${created} new invitation(s).`);
    return created;
}

async function main() {
    const ids = gameIds();
    if (ids.length === 0) {
        console.log('Usage: node reinvite_game.js --game <id> [--game <id>] [--write]');
        process.exit(1);
    }
    if (!process.env.ALGOLIA_ADMIN_KEY) {
        console.error('Missing ALGOLIA_ADMIN_KEY. See the header of this file.');
        process.exit(1);
    }

    console.log(WRITE ? 'MODE: WRITE (this creates real invitations)' : 'MODE: DRY RUN (nothing is written)');
    const index = getAvailabilitiesIndex(process.env.ALGOLIA_ADMIN_KEY);

    let total = 0;
    for (const id of ids) total += await reinvite(id, index);

    console.log(
        WRITE
            ? `\n✅ ${total} invitation(s) created.\n`
            : '\n✅ Dry run complete, nothing written. Re-run with --write.\n'
    );
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
