/**
 * Create the Poteau Max pro account for Soccer Arena 13 (Saint-Cannat, France).
 *
 * Creates, in order:
 *   1. Firebase Auth user (email-based, no password - the centre signs in via OTC/magic link)
 *   2. users/{uid} document (type: "pro")
 *   3. A default custom_messages entry so the centre sees an example template
 *   4. A cached_centres entry so the centre is discoverable in the B2C app
 *
 * Field set follows the most recent real pro accounts (LE FIVE Colombes,
 * 4PADEL Argenteuil, Nov 2025) rather than the older createCentreUser.js,
 * which omits `sports`, `accounts`, `country_code` and the cached_centres entry.
 *
 * Idempotent: aborts if the Auth user, the pro doc or the cached centre already exist.
 *
 * Run: node createSoccerArena13.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

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
    email: 'bubblefootetcompagnie@gmail.com',
    centre_name: 'Soccer Arena 13',
    short_name: 'soccer-arena-13',
    type: 'pro',
    photo_url:
        'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fsoccer-arena-13-logo.png?alt=media&token=4edd6f25-8b67-4ae2-8db0-015c0dac7249',
    hash_pic: 'L69%q}xu01IU~pWBIWRi00Nes7s+',

    // Contact
    centre_user_first_name: 'Philippe',
    centre_user_last_name: '',
    centre_user_gender: 'man',
    centre_user_role: 'owner',

    // Location
    centre_address: "212 Av. de l'Europe, 13760 Saint-Cannat, France",
    centre_country: 'France',
    country_code: 'FR',
    centre_place_id: 'ChIJ_ylQMbH1yRIRm7p4aTebc3E',
    centre_location: { lat: '43.6144599', lng: '5.3064208' },

    // Offer
    sports: ['soccer'],
    centre_football_fields: 1,
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

// Image used in the B2C app's centre cache (same as the account logo).
const CACHED_CENTRE_IMAGE = CENTRE.photo_url;

// ---------------------------------------------------------------------------

async function assertDoesNotExist() {
    console.log('➡️  Checking the centre does not already exist...');

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

    const cached = await db.collection('cached_centres').doc(CENTRE.centre_place_id).get();
    if (cached.exists) {
        throw new Error(`cached_centres/${CENTRE.centre_place_id} already exists. Aborting.`);
    }

    console.log('✅ No existing account found.');
}

async function createAuthUser() {
    console.log('➡️  Creating Firebase Auth user...');
    const userRecord = await admin.auth().createUser({
        email: CENTRE.email,
        displayName: CENTRE.centre_name,
        photoURL: CENTRE.photo_url,
    });
    console.log(`✅ Auth user created. UID: ${userRecord.uid}`);
    return userRecord.uid;
}

async function createUserDoc(uid) {
    console.log('➡️  Writing users/%s...', uid);
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

    await db.collection('users').doc(uid).set(data);
    console.log('✅ users/%s written.', uid);
}

async function createDefaultCustomMessage(uid) {
    console.log('➡️  Creating default custom message...');
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
            content: 'Ecco il tipo di messaggio che puoi preparare e inviare con un clic su Poteau Max',
        },
    };
    const translation = translations[CENTRE.language] || translations.fr;

    const ref = await db.collection('custom_messages').add({
        created: admin.firestore.FieldValue.serverTimestamp(),
        last_edited_time: admin.firestore.FieldValue.serverTimestamp(),
        last_edited_by: uid,
        title: translation.title,
        content: translation.content,
        user_id: uid,
    });
    console.log(`✅ custom_messages/${ref.id} created.`);
}

async function createCachedCentre() {
    console.log('➡️  Creating cached_centres entry...');
    await db.collection('cached_centres').doc(CENTRE.centre_place_id).set({
        centre_name: CENTRE.centre_name,
        centre_place_id: CENTRE.centre_place_id,
        centre_address: CENTRE.centre_address,
        centre_location: new admin.firestore.GeoPoint(
            parseFloat(CENTRE.centre_location.lat),
            parseFloat(CENTRE.centre_location.lng)
        ),
        centre_image: CACHED_CENTRE_IMAGE,
        sports: CENTRE.sports,
        priority: 1,
    });
    console.log(`✅ cached_centres/${CENTRE.centre_place_id} created.`);
}

async function main() {
    try {
        console.log(`\n🚀 Creating Poteau Max account for ${CENTRE.centre_name}\n`);

        await assertDoesNotExist();
        const uid = await createAuthUser();
        await createUserDoc(uid);
        await createDefaultCustomMessage(uid);
        await createCachedCentre();

        console.log('\n========================================');
        console.log('🎉 Account created successfully');
        console.log('========================================');
        console.log(`Centre:   ${CENTRE.centre_name}`);
        console.log(`Email:    ${CENTRE.email}`);
        console.log(`UID:      ${uid}`);
        console.log(`Place ID: ${CENTRE.centre_place_id}`);
        console.log('========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ SCRIPT FAILED:', error.message);
        process.exit(1);
    }
}

main();
