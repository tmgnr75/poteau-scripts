/**
 * Create the Poteau Max pro account for LE PARK Servon (Servon, France).
 *
 * Creates, in order:
 *   1. Firebase Auth user (email-based, no password - the centre signs in via OTC/magic link)
 *   2. users/{uid} document (type: "pro")
 *   3. A default custom_messages entry so the centre sees an example template
 *   4. Updates the EXISTING cached_centres entry (it already exists - see below)
 *
 * Field set follows createSoccerArena13.js, which matches the most recent real
 * pro accounts (Soccer Arena 13 Jul 2026, 4PADEL Argenteuil Nov 2025).
 *
 * WHAT MAKES THIS ONE DIFFERENT FROM A COLD CENTRE
 * ------------------------------------------------
 * Le Park Servon is NOT a new venue on Poteau. As of 2026-09-09 it already has:
 *   - 469 games at this place_id, 217 of them played, going back to 2023-09-28
 *   - 247 unique players who have played there, 83 of them in 2026 alone
 *   - 44 played games in 2026 across 18 distinct organizers
 *   - a cached_centres doc already present (soccer only, priority 0)
 *
 * Every one of those games was organized by a PLAYER, never by the centre.
 * There is no pro account and no repeater. So this script does not open a
 * market - it hands the keys to a market that already runs itself.
 *
 * Two consequences the script encodes deliberately:
 *   - cached_centres is UPDATED, not created. Creating it would wipe the
 *     existing doc's priority. We merge and add padel.
 *   - priority is raised 0 -> 1, matching what createSoccerArena13.js sets for
 *     a live partner centre.
 *
 * NOT IN SCOPE: "LE PARK Noisy" also exists in cached_centres with 193 games
 * and no pro account, but it is a different business (lepark.fr covers Servon
 * only) and Google lists it as permanently closed. It is deliberately left
 * alone here - do not fold it into this account.
 *
 * Idempotent: aborts if the Auth user or the pro doc already exist. The
 * cached_centres update is a merge, so re-running it is harmless.
 *
 * Run: node createLeParkServon.js          (dry run, writes nothing)
 *      node createLeParkServon.js --write  (actually creates the account)
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

const WRITE = process.argv.includes('--write');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ---------------------------------------------------------------------------
// Centre data
// ---------------------------------------------------------------------------

const CENTRE = {
    // Core identity
    email: 'contact@lepark.fr',
    centre_name: 'LE PARK Servon',
    short_name: 'le-park-servon',
    type: 'pro',

    // Logo, hosted by us in Firebase Storage rather than hotlinked from
    // lepark.fr, which we do not control.
    //
    // The file the centre supplied was a 512x177 rectangle in PURE WHITE on a
    // transparent background. Uploaded as-is it would have been invisible:
    // CentreItemWidget draws the logo over FlutterFlowTheme.secondaryBackground,
    // which is #FFFFFF. So it was composited onto Le Park's navy (which is also
    // Poteau's darkBlue #00204A) and padded to a 1024x1024 square.
    //
    // The square matters for a second reason: the card crops the image with
    // BoxFit.cover into a 75px-wide vertical strip, keeping only the central
    // ~68% of the width. The wordmark is scaled to 62% so all of it survives
    // that crop. Flattened to RGB (no alpha) to stay clear of the Apple
    // alpha-channel trap.
    photo_url:
        'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fle-park-servon-logo.png?alt=media&token=4e44b8db-f730-4b8a-b266-b28c63c46e81',
    hash_pic: 'LB6IBea#9Fj]j]kCj[WB00j[.8az',

    // Contact
    centre_user_first_name: 'Emmanuel',
    centre_user_last_name: 'Legret',
    centre_user_gender: 'man',
    centre_user_role: 'owner',

    // Location. Coordinates come from the cached_centres doc already in prod,
    // which resolved this same Google place_id.
    centre_address: "ZAC DE L'ORME ROND, Rue de l'Ormeteau, 77170 Servon, France",
    centre_country: 'France',
    country_code: 'FR',
    centre_place_id: 'ChIJMU8gErUJ5kcRSnpvacKwFtM',
    centre_location: { lat: '48.7118959', lng: '2.5771181' },

    // Offer. The application form declares 3 soccer pitches and 3 padel courts.
    sports: ['soccer', 'padel'],
    centre_football_fields: 3,
    centre_currency: 'EUR',
    centre_payment_type: 'on-site',

    // Plan
    centre_plan_status: 'active',
    centre_plan_next_renew: '2030-01-01',
    centre_poteau_max: false,

    // Settings
    language: 'fr',
    time_zone: 'Europe/Paris',
    last_onboarding_step: 'complete',
    centre_share_onsite: false,
};

// Raised from the existing 0. Matches what we set for other live partners.
const CACHED_CENTRE_PRIORITY = 1;

// ---------------------------------------------------------------------------

function log(...args) {
    console.log(...args);
}

function wouldWrite(what) {
    log(`   ${WRITE ? '✏️  writing' : '🔍 would write'}: ${what}`);
}

async function assertDoesNotExist() {
    log('➡️  Checking the centre does not already exist...');

    try {
        const existing = await admin.auth().getUserByEmail(CENTRE.email);
        throw new Error(
            `An Auth user already exists for ${CENTRE.email} (uid ${existing.uid}). Aborting.`
        );
    } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
    }

    const byPlaceId = await db
        .collection('users')
        .where('centre_place_id', '==', CENTRE.centre_place_id)
        .get();
    if (!byPlaceId.empty) {
        throw new Error(
            `A user doc already has centre_place_id ${CENTRE.centre_place_id} (${byPlaceId.docs
                .map((d) => d.id)
                .join(', ')}). Aborting.`
        );
    }

    log('✅ No existing pro account found.');
}

async function reportExistingActivity() {
    log('\n➡️  Existing activity at this place_id (context, not a check)...');

    const games = await db
        .collection('games')
        .where('place_id', '==', CENTRE.centre_place_id)
        .get();

    const byStatus = {};
    const players = new Set();
    let earliest = null;
    games.forEach((doc) => {
        const game = doc.data();
        byStatus[game.status] = (byStatus[game.status] || 0) + 1;
        // A +1 is stored as the same user reference repeated, so dedupe.
        new Set((game.attendees || []).map((ref) => ref.path)).forEach((p) => players.add(p));
        const date = game.date && game.date.toDate ? game.date.toDate() : null;
        if (date && (!earliest || date < earliest)) earliest = date;
    });

    log(`   games: ${games.size} (${JSON.stringify(byStatus)})`);
    log(`   unique players ever: ${players.size}`);
    log(`   first game: ${earliest ? earliest.toISOString().slice(0, 10) : 'n/a'}`);
    log('   organizer: players only, no pro account and no repeater.');
}

async function createAuthUser() {
    log('\n➡️  Creating Firebase Auth user...');
    wouldWrite(`auth user ${CENTRE.email} (displayName "${CENTRE.centre_name}")`);
    if (!WRITE) return 'DRY_RUN_UID';

    const userRecord = await admin.auth().createUser({
        email: CENTRE.email,
        displayName: CENTRE.centre_name,
        photoURL: CENTRE.photo_url || undefined,
    });
    log(`✅ Auth user created. UID: ${userRecord.uid}`);
    return userRecord.uid;
}

async function createUserDoc(uid) {
    log(`\n➡️  Writing users/${uid}...`);
    const now = new Date();

    const data = {
        // Core identity
        uid,
        email: CENTRE.email,
        display_name: CENTRE.centre_name,
        type: CENTRE.type,
        photo_url: CENTRE.photo_url,
        hash_pic: CENTRE.hash_pic,
        short_name: CENTRE.short_name,

        // Contact
        centre_user_first_name: CENTRE.centre_user_first_name,
        centre_user_last_name: CENTRE.centre_user_last_name,
        centre_user_gender: CENTRE.centre_user_gender,
        centre_user_role: CENTRE.centre_user_role,
        phone_number: null,

        // Centre info
        centre_name: CENTRE.centre_name,
        centre_address: CENTRE.centre_address,
        centre_country: CENTRE.centre_country,
        country_code: CENTRE.country_code,
        centre_place_id: CENTRE.centre_place_id,
        centre_location: new admin.firestore.GeoPoint(
            parseFloat(CENTRE.centre_location.lat),
            parseFloat(CENTRE.centre_location.lng)
        ),
        centre_currency: CENTRE.centre_currency,
        centre_football_fields: CENTRE.centre_football_fields,
        sports: CENTRE.sports,

        // Plan
        centre_plan_status: CENTRE.centre_plan_status,
        centre_plan_next_renew: new Date(CENTRE.centre_plan_next_renew),
        centre_payment_type: CENTRE.centre_payment_type,
        centre_poteau_max: CENTRE.centre_poteau_max,

        // Settings
        language: CENTRE.language,
        time_zone: CENTRE.time_zone,
        last_onboarding_step: CENTRE.last_onboarding_step,
        centre_share_onsite: CENTRE.centre_share_onsite,
        centre_poster: null,
        centre_fff: false,
        centre_gold_default: false,

        // Access. Must contain at least its own uid, otherwise the account
        // can't reach any centre once signed in.
        accounts: [uid],

        // Timestamps
        created_time: now,
        last_activity_date: now,
        last_messenger: now,

        // Counters
        revenue_since_1st: 0,
        organized_since_1st: 0,
        played_since_1st: 0,
        centre_unread_messenger: 0,
        centre_ratings_count: 0,
        centre_ratings_average: 0,
        followers: 0,
        players: 0,

        // Flags
        banned: false,
        gold_status: false,
        centre_account_activated: true,
    };

    wouldWrite(`users/${uid} (type=pro, sports=${JSON.stringify(CENTRE.sports)})`);
    if (!WRITE) return;

    await db.collection('users').doc(uid).set(data);
    log(`✅ users/${uid} written.`);
}

async function createDefaultCustomMessage(uid) {
    log('\n➡️  Creating default custom message...');
    const translations = {
        fr: {
            title: 'Exemple de message personnalisé',
            content:
                'Voici le genre de message que vous pouvez préparer et envoyer en un clic sur Poteau Max',
        },
        en: {
            title: 'Custom message example',
            content:
                "Here's the kind of message you can prepare and send with one click on Poteau Max",
        },
        es: {
            title: 'Ejemplo de mensaje personalizado',
            content:
                'Este es el tipo de mensaje que puede preparar y enviar con un solo clic en Poteau Max',
        },
        it: {
            title: 'Esempio di messaggio personalizzato',
            content:
                'Ecco il tipo di messaggio che puoi preparare e inviare con un clic su Poteau Max',
        },
    };
    const translation = translations[CENTRE.language] || translations.fr;

    wouldWrite(`custom_messages/<auto> ("${translation.title}")`);
    if (!WRITE) return;

    const ref = await db.collection('custom_messages').add({
        created: admin.firestore.FieldValue.serverTimestamp(),
        last_edited_time: admin.firestore.FieldValue.serverTimestamp(),
        last_edited_by: uid,
        title: translation.title,
        content: translation.content,
        user_id: uid,
    });
    log(`✅ custom_messages/${ref.id} created.`);
}

/**
 * The cached_centres doc already exists for this place_id (soccer only,
 * priority 0). We merge rather than set-without-merge so we never drop a field
 * someone added by hand, and we add padel so padel players in the area can
 * actually find the centre.
 */
async function updateCachedCentre() {
    log('\n➡️  Updating cached_centres entry...');

    const ref = db.collection('cached_centres').doc(CENTRE.centre_place_id);
    const snap = await ref.get();

    if (!snap.exists) {
        log('   note: doc did not exist after all, it will be created.');
    } else {
        const before = snap.data();
        log(`   before: sports=${JSON.stringify(before.sports)} priority=${before.priority} ` +
            `address=${before.centre_address || '(none)'}`);
    }

    const payload = {
        centre_name: CENTRE.centre_name,
        centre_place_id: CENTRE.centre_place_id,
        centre_address: CENTRE.centre_address,
        centre_location: new admin.firestore.GeoPoint(
            parseFloat(CENTRE.centre_location.lat),
            parseFloat(CENTRE.centre_location.lng)
        ),
        sports: CENTRE.sports,
        priority: CACHED_CENTRE_PRIORITY,
    };
    if (CENTRE.photo_url) payload.centre_image = CENTRE.photo_url;

    wouldWrite(
        `cached_centres/${CENTRE.centre_place_id} (merge) -> ` +
            `sports=${JSON.stringify(CENTRE.sports)} priority=${CACHED_CENTRE_PRIORITY}`
    );
    if (!WRITE) return;

    await ref.set(payload, { merge: true });
    log(`✅ cached_centres/${CENTRE.centre_place_id} updated.`);
}

async function main() {
    try {
        log(`\n🚀 Creating Poteau Max account for ${CENTRE.centre_name}`);
        log(WRITE ? '   MODE: WRITE (this touches production)\n' : '   MODE: DRY RUN (nothing is written)\n');

        await assertDoesNotExist();
        await reportExistingActivity();

        const uid = await createAuthUser();
        await createUserDoc(uid);
        await createDefaultCustomMessage(uid);
        await updateCachedCentre();

        log('\n========================================');
        log(WRITE ? '🎉 Account created successfully' : '✅ Dry run complete, nothing written');
        log('========================================');
        log(`Centre:   ${CENTRE.centre_name}`);
        log(`Email:    ${CENTRE.email}`);
        log(`UID:      ${uid}`);
        log(`Place ID: ${CENTRE.centre_place_id}`);
        log(`Sports:   ${CENTRE.sports.join(', ')}`);
        log('========================================');
        if (!WRITE) log('\nRe-run with --write to actually create the account.\n');
        else log('');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ SCRIPT FAILED:', error.message);
        process.exit(1);
    }
}

main();
