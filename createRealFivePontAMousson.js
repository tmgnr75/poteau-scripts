/**
 * Create the Poteau Max pro account for RealFive (Lesménils, near Pont-à-Mousson).
 *
 * Creates, in order:
 *   1. Firebase Auth user (email-based, no password - the centre signs in via OTC/magic link)
 *   2. users/{uid} document (type: "pro")
 *   3. A default custom_messages entry so the centre sees an example template
 *   4. The cached_centres entry (CREATED, not merged - see below)
 *   5. Appends the new uid to centres@poteau.team's `accounts`, so Tim can
 *      switch into the centre in Poteau Max without a magic link.
 *
 * Field set follows createLeParkServon.js (2026-09-09), itself following
 * createSoccerArena13.js.
 *
 * WHAT MAKES THIS ONE DIFFERENT FROM LE PARK
 * ------------------------------------------
 * Le Park Servon was handed an existing market: 469 games at its place_id and
 * 645 alerts before it ever got an account. RealFive is the opposite, and every
 * number below was measured on 2026-09-14 against the confirmed coordinates:
 *
 *   - 0 games ever organized within 15 km of the venue
 *   - 0 alerts on this place_id
 *   - no cached_centres doc
 *   - 48 players whose `availabilities` radius reaches the venue, 23 of them
 *     with at least one time slot ticked, 19 active in the last 90 days
 *   - none of those 48 has ever played a game on Poteau
 *
 * That last line is the one that matters. The demand here is latent, not
 * proven, so nothing in the welcome message promises a crowd. See
 * sendWelcomeMessengerRealFive.js.
 *
 * Two consequences the script encodes deliberately:
 *   - cached_centres is CREATED (set, no merge). Le Park's script merged
 *     because a doc already existed; here it must not, and the script aborts
 *     if one turns up, rather than overwriting something unexpected.
 *   - priority is 1 here, raised to 2 by the finalize script, matching the
 *     convention the other partner centres share.
 *
 * ON THE NAME
 * -----------
 * Displayed as "RealFive Pont-à-Mousson" though the venue sits in Lesménils,
 * 6 km north. Pont-à-Mousson is the town players search for, and the "BRAND
 * Ville" shape matches LE FIVE Metz / 4PADEL Metz / LE PARK Servon. The
 * address field carries the real location.
 *
 * Idempotent: aborts if the Auth user, the pro doc, or the cached_centres doc
 * already exist.
 *
 * Run: node createRealFivePontAMousson.js          (dry run, writes nothing)
 *      node createRealFivePontAMousson.js --write  (actually creates the account)
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
// Centre data. Everything here comes from the application form Fares
// submitted (2026-09-13) except the coordinates and address, confirmed by Tim.
// ---------------------------------------------------------------------------

const CENTRE = {
    // Core identity
    email: 'team@realfive.fr',
    centre_name: 'RealFive Pont-à-Mousson',
    short_name: 'realfive-pont-a-mousson',
    type: 'pro',

    // Logo, hosted by us rather than hotlinked from a site we do not control.
    //
    // This is the R5 monogram, not the "RealFive" wordmark. Both exist; the
    // monogram is the right one for the card, which crops with BoxFit.cover
    // into a 75px-wide vertical strip and keeps only the central ~68% of the
    // width. A long wordmark loses its ends in that crop.
    //
    // The supplied file was a 1024x1024 JPEG on white. Two things still had to
    // be done: the ink was trimmed to its real bounding box (an exact-match
    // bbox returns the whole frame, because JPEG white is noisy - threshold at
    // 240 instead), then fitted to 62% of a 1024x1024 white square along its
    // longest side and centred. Saved as RGB with no alpha, to stay clear of
    // the Apple alpha-channel trap.
    photo_url:
        'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Frealfive-pont-a-mousson-logo.png?alt=media&token=92024174-650f-40b3-96b1-d18e228b5fe4',
    hash_pic: 'LbR{ofbv.8$*t7fkofj[_NsTD%OD',

    // Contact
    centre_user_first_name: 'Fares',
    centre_user_last_name: 'BELGHITH',
    centre_user_gender: 'man',
    centre_user_role: 'owner',

    // Location. The venue is in Lesménils; the display name says
    // Pont-à-Mousson because that is the town players search for.
    centre_address: '247 A Rue du Chêne Brûlé, 54700 Lesménils, France',
    centre_country: 'France',
    country_code: 'FR',
    centre_place_id: 'ChIJ6zeXoQXHlEcRJOm0i4shoAg',
    centre_location: { lat: '48.937931', lng: '6.112316' },

    // Offer. The application form declares 2 soccer pitches and no padel.
    sports: ['soccer'],
    centre_football_fields: 2,
    centre_currency: 'EUR',
    centre_payment_type: 'on-site',

    // Plan. Free September and October 2026; tiered billing from November.
    // The deal lives in billing/config.js and billing/preflight.js, not here -
    // this document has no concept of a price.
    centre_plan_status: 'active',
    centre_plan_next_renew: '2030-01-01',
    centre_poteau_max: false,

    // Settings
    language: 'fr',
    time_zone: 'Europe/Paris',
    last_onboarding_step: 'complete',
    centre_share_onsite: false,
};

// Raised to 2 by finalizeRealFivePontAMousson.js, matching the other partners.
const CACHED_CENTRE_PRIORITY = 1;

// Tim tests partner centres through this account, not through his own user
// account (which is type "user" with an empty accounts array). See
// createLeParkServon.js's sibling step and the memory note.
const TIM_TESTING_PRO_UID = 'zCvsukfMuuffsuPpSTQwb7MusMD2'; // centres@poteau.team

// ---------------------------------------------------------------------------

function log(...args) {
    console.log(...args);
}

function wouldWrite(what) {
    log(`   ${WRITE ? '✏️  writing' : '🔍 would write'}: ${what}`);
}

async function assertDoesNotExist() {
    log('➡️  Checking the centre does not already exist...');

    if (CENTRE.photo_url.includes('__TOKEN__')) {
        throw new Error(
            'photo_url still contains the __TOKEN__ placeholder. ' +
                'Run uploadRealFiveLogo.js --write first and paste the URL it prints.'
        );
    }

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

    // Unlike Le Park, this doc must NOT already exist. If it does, something
    // is different from what was measured and overwriting it would be wrong.
    const cached = await db.collection('cached_centres').doc(CENTRE.centre_place_id).get();
    if (cached.exists) {
        throw new Error(
            `cached_centres/${CENTRE.centre_place_id} already exists: ` +
                `${JSON.stringify(cached.data())}. Aborting rather than overwriting.`
        );
    }

    log('✅ No existing pro account, and no cached_centres doc.');
}

/**
 * Prints the demand picture. Unlike Le Park's version of this function, the
 * point here is to confirm the venue is COLD, so that nobody later reads the
 * welcome message and assumes a crowd was promised.
 */
async function reportExistingActivity() {
    log('\n➡️  Existing activity at this place_id (context, not a check)...');

    const games = await db
        .collection('games')
        .where('place_id', '==', CENTRE.centre_place_id)
        .get();

    log(`   games at this place_id: ${games.size}`);

    const alerts = await db.collection('alerts').get();
    let onPlace = 0;
    alerts.forEach((doc) => {
        const data = doc.data();
        if ((data.places || []).some((place) => place.placeId === CENTRE.centre_place_id)) onPlace++;
    });
    log(`   alerts on this place_id: ${onPlace} (of ${alerts.size} scanned)`);

    // The one real signal: availabilities whose declared radius covers the
    // venue. `radius` is stored in METRES, which is easy to get wrong - read
    // as kilometres it matches every document in the collection.
    const LAT = parseFloat(CENTRE.centre_location.lat);
    const LNG = parseFloat(CENTRE.centre_location.lng);
    const toRad = (deg) => (deg * Math.PI) / 180;
    const distanceKm = (lat, lng) => {
        const dLat = toRad(lat - LAT);
        const dLng = toRad(lng - LNG);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
        return 2 * 6371 * Math.asin(Math.sqrt(a));
    };

    const availabilities = await db.collection('availabilities').get();
    const reaching = [];
    availabilities.forEach((doc) => {
        const data = doc.data();
        const location = data.location;
        if (!location || location.latitude == null) return;
        if (typeof data.radius !== 'number') return;
        if (distanceKm(location.latitude, location.longitude) <= data.radius / 1000) {
            reaching.push(data);
        }
    });
    const withSlots = reaching.filter((a) => (a.slots || []).length > 0);
    log(`   availabilities reaching the venue: ${reaching.length}`);
    log(`   of those, with a time slot ticked: ${withSlots.length}`);
    log('   none of those players has ever played a game (measured 2026-09-14).');
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
 * Created outright, unlike Le Park's merge: there is no existing doc here, and
 * assertDoesNotExist() has already refused to continue if one appeared.
 *
 * `centre_address` is deliberately NOT written. Soccer Arena 13 was the only
 * one of 1247 entries carrying it, and Le Park's finalize script had to delete
 * it again afterwards.
 */
async function createCachedCentre() {
    log('\n➡️  Creating cached_centres entry...');

    const payload = {
        centre_name: CENTRE.centre_name,
        centre_place_id: CENTRE.centre_place_id,
        centre_location: new admin.firestore.GeoPoint(
            parseFloat(CENTRE.centre_location.lat),
            parseFloat(CENTRE.centre_location.lng)
        ),
        sports: CENTRE.sports,
        priority: CACHED_CENTRE_PRIORITY,
    };
    if (CENTRE.photo_url) payload.centre_image = CENTRE.photo_url;

    wouldWrite(
        `cached_centres/${CENTRE.centre_place_id} (create) -> ` +
            `sports=${JSON.stringify(CENTRE.sports)} priority=${CACHED_CENTRE_PRIORITY}`
    );
    if (!WRITE) return;

    await db.collection('cached_centres').doc(CENTRE.centre_place_id).set(payload);
    log(`✅ cached_centres/${CENTRE.centre_place_id} created.`);
}

/**
 * Give Tim's testing account access to the new centre.
 *
 * arrayUnion, so re-running adds nothing. This is the account with 54 centres
 * in it, not Tim's personal user account.
 */
async function grantTestingAccess(uid) {
    log('\n➡️  Granting access to the testing account...');

    const ref = db.collection('users').doc(TIM_TESTING_PRO_UID);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new Error(`Testing account ${TIM_TESTING_PRO_UID} not found.`);
    }

    const accounts = snap.get('accounts') || [];
    log(`   ${snap.get('email')} currently has ${accounts.length} centre(s).`);

    if (accounts.includes(uid)) {
        log('   already has access, skipping.');
        return;
    }

    wouldWrite(`users/${TIM_TESTING_PRO_UID}.accounts += ${uid}`);
    if (!WRITE) return;

    await ref.update({ accounts: admin.firestore.FieldValue.arrayUnion(uid) });
    log(`✅ ${snap.get('email')} can now switch into ${CENTRE.centre_name}.`);
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
        await createCachedCentre();
        await grantTestingAccess(uid);

        log('\n========================================');
        log(WRITE ? '🎉 Account created successfully' : '✅ Dry run complete, nothing written');
        log('========================================');
        log(`Centre:   ${CENTRE.centre_name}`);
        log(`Address:  ${CENTRE.centre_address}`);
        log(`Email:    ${CENTRE.email}`);
        log(`UID:      ${uid}`);
        log(`Place ID: ${CENTRE.centre_place_id}`);
        log(`Sports:   ${CENTRE.sports.join(', ')}`);
        log('========================================');
        if (!WRITE) {
            log('\nRe-run with --write to actually create the account.\n');
        } else {
            log('\nNext: finalizeRealFivePontAMousson.js (QR code, priority, alerts_centres),');
            log('then sendWelcomeMessengerRealFive.js.\n');
        }

        process.exit(0);
    } catch (error) {
        console.error('\n❌ SCRIPT FAILED:', error.message);
        process.exit(1);
    }
}

main();
