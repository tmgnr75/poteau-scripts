const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function createCentreUser(data) {
    try {
        console.log(`🚀 Starting user creation for: ${data.centre_name || data.display_name}...`);

        const display_name = data.display_name || data.centre_name;

        // Step 1: Create Firebase Authentication User
        console.log('➡️ Creating Firebase Authentication user...');
        const userRecord = await admin.auth().createUser({
            email: data.email,
            displayName: display_name,
            photoURL: data.photo_url || null,
        });
        const uid = userRecord.uid;
        console.log(`✅ Firebase Authentication user created. UID: ${uid}`);

        // Step 2: Prepare Firestore Data
        const created_time = new Date();
        const firestoreData = {
            // Core Identity
            uid,
            email: data.email,
            display_name,
            type: data.type,
            photo_url: data.photo_url || null,
            hash_pic: data.hash_pic || null,

            // User Info
            centre_user_first_name: data.centre_user_first_name,
            centre_user_last_name: data.centre_user_last_name,
            centre_user_gender: data.centre_user_gender,
            centre_user_role: data.centre_user_role,
            short_name: data.short_name || null,

            // Centre Info (only for pro accounts)
            centre_name: data.centre_name || null,
            centre_address: data.centre_address || null,
            centre_country: data.centre_country || null,
            centre_place_id: data.centre_place_id || null,
            centre_location: data.centre_location
                ? new admin.firestore.GeoPoint(
                    parseFloat(data.centre_location.lat),
                    parseFloat(data.centre_location.lng)
                )
                : null,
            centre_currency: data.centre_currency || null,
            centre_football_fields: data.centre_football_fields ?? null,

            // Plan Info (only for pro accounts)
            centre_plan_status: data.centre_plan_status || null,
            centre_plan_next_renew: data.centre_plan_next_renew
                ? new Date(data.centre_plan_next_renew)
                : null,
            centre_payment_type: data.centre_payment_type || null,
            centre_poteau_max: data.centre_poteau_max ?? false,

            // Settings
            language: data.language,
            time_zone: data.time_zone,
            last_onboarding_step: data.last_onboarding_step || 'complete',
            centre_share_onsite: data.centre_share_onsite ?? false,

            // Optional
            centre_poster: data.centre_poster || null,
            phone_number: data.phone_number || null,
            centre_fff: data.centre_fff ?? false,
            centre_gold_default: data.centre_gold_default ?? false,

            // Accounts array (for super_pro linking)
            accounts: data.accounts || [],

            // Timestamps
            created_time,
            last_activity_date: created_time,
            last_messenger: created_time,

            // Default counters
            revenue_since_1st: 0,
            organized_since_1st: 0,
            played_since_1st: 0,
            centre_unread_messenger: 0,
            centre_ratings_count: 0,
            centre_ratings_average: 0,
            followers: 0,
            players: 0,

            // Default booleans
            banned: false,
            gold_status: false,
            centre_account_activated: true,
        };

        // Step 3: Write Data to Firestore
        console.log('➡️ Writing user data to Firestore...');
        await db.collection('users').doc(uid).set(firestoreData);
        console.log(`✅ Firestore document created for UID: ${uid}`);

        return uid;
    } catch (error) {
        console.error('❌ Error during user creation:', error.message);
        console.error(error);
        throw error;
    }
}

async function main() {
    try {
        // ============================================
        // PRO USER 1: LE FIVE Colombes
        // ============================================
        const leFiveColombesData = {
            // Core Identity
            email: 'colombes@lefive.fr',
            display_name: 'LE FIVE Colombes',
            type: 'pro',
            photo_url: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/users%2FIzKPWsB4aacK86ccCoYIsIi4bEH3%2Fuploads%2F1693830530094545.jpg?alt=media&token=1a589027-025a-41c6-ad5b-202bb26cf92c',
            hash_pic: 'KCMtaOof0000ay_3xufQ~q',

            // User Info - REPLACE WITH ACTUAL VALUES
            centre_user_first_name: '[Ton prénom]',
            centre_user_last_name: '[Ton nom]',
            centre_user_gender: 'man',
            centre_user_role: 'staff',
            short_name: 'le-five-colombes',

            // Centre Info
            centre_name: 'LE FIVE Colombes',
            centre_address: '6 Rue Gisèle Halimi, 92700 Colombes, France',
            centre_country: 'France',
            centre_place_id: 'ChIJtW2wgSxl5kcRW1N56-y8ETo',
            centre_location: { lat: '48.9272376', lng: '2.2144731' },
            centre_currency: 'EUR',
            centre_football_fields: 4,

            // Plan Info
            centre_plan_status: 'active',
            centre_plan_next_renew: '2030-01-01',
            centre_payment_type: 'hybrid',
            centre_poteau_max: false,

            // Settings
            language: 'fr',
            time_zone: 'Europe/Paris',
            last_onboarding_step: 'complete',
            centre_share_onsite: false,
        };

        console.log('\n========================================');
        console.log('Creating PRO USER 1: LE FIVE Colombes');
        console.log('========================================\n');
        const leFiveColombesUid = await createCentreUser(leFiveColombesData);

        // ============================================
        // PRO USER 2: 4PADEL Argenteuil
        // ============================================
        const fourPadelArgenteuil = {
            // Core Identity
            email: 'argenteuil@4padel.fr',
            display_name: '4PADEL Argenteuil',
            type: 'pro',
            photo_url: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2F567420366_17842042581602643_8867725249913169582_n.jpg?alt=media&token=607750e7-ced4-4536-9ec1-bf4b3860b075',
            hash_pic: 'L25=#eEA0E-$-,a{N2j[0I-i~cD?',

            // User Info - REPLACE WITH ACTUAL VALUES
            centre_user_first_name: '[Ton prénom]',
            centre_user_last_name: '[Ton nom]',
            centre_user_gender: 'man',
            centre_user_role: 'staff',
            short_name: '4padel-argenteuil',

            // Centre Info
            centre_name: '4PADEL Argenteuil',
            centre_address: '26 Rue de la Fosse aux Loups, 95100 Argenteuil, France',
            centre_country: 'France',
            centre_place_id: 'ChIJ33T-c5pn5kcR9aJNxp19dtY',
            centre_location: { lat: '48.949798', lng: '2.2103022' },
            centre_currency: 'EUR',
            centre_football_fields: 0,

            // Plan Info
            centre_plan_status: 'active',
            centre_plan_next_renew: '2030-01-01',
            centre_payment_type: 'hybrid',
            centre_poteau_max: false,

            // Settings
            language: 'fr',
            time_zone: 'Europe/Paris',
            last_onboarding_step: 'complete',
            centre_share_onsite: false,
        };

        console.log('\n========================================');
        console.log('Creating PRO USER 2: 4PADEL Argenteuil');
        console.log('========================================\n');
        const fourPadelArgenteuiUid = await createCentreUser(fourPadelArgenteuil);

        // ============================================
        // ADMIN USER: Virginie Renouf (super_pro)
        // ============================================
        const virginieRenoufData = {
            // Core Identity
            email: 'virginie.renouf@lefive.fr',
            display_name: 'Virginie Renouf',
            type: 'super_pro',
            photo_url: null,
            hash_pic: null,

            // User Info
            centre_user_first_name: 'Virginie',
            centre_user_last_name: 'Renouf',
            centre_user_gender: 'woman',
            centre_user_role: 'director',
            short_name: null,

            // Centre Info - null for super_pro admin
            centre_name: null,
            centre_address: null,
            centre_country: 'France',
            centre_place_id: null,
            centre_location: null,
            centre_currency: 'EUR',
            centre_football_fields: null,

            // Plan Info - null for super_pro admin
            centre_plan_status: null,
            centre_plan_next_renew: null,
            centre_payment_type: null,
            centre_poteau_max: false,

            // Settings
            language: 'fr',
            time_zone: 'Europe/Paris',
            last_onboarding_step: 'complete',

            // Accounts array - linking to the centres she manages
            accounts: [
                leFiveColombesUid,
                fourPadelArgenteuiUid,
                'U3MriTZbPbTUEsU6RtRuHxDMKvg2',
            ],
        };

        console.log('\n========================================');
        console.log('Creating ADMIN USER: Virginie Renouf');
        console.log('========================================\n');
        const virginieRenoufUid = await createCentreUser(virginieRenoufData);

        // ============================================
        // SUMMARY
        // ============================================
        console.log('\n========================================');
        console.log('🎉 ALL USERS CREATED SUCCESSFULLY!');
        console.log('========================================');
        console.log(`\nLE FIVE Colombes UID:    ${leFiveColombesUid}`);
        console.log(`4PADEL Argenteuil UID:   ${fourPadelArgenteuiUid}`);
        console.log(`Virginie Renouf UID:     ${virginieRenoufUid}`);
        console.log('\nVirginie Renouf accounts array:');
        console.log(`  - ${leFiveColombesUid} (LE FIVE Colombes)`);
        console.log(`  - ${fourPadelArgenteuiUid} (4PADEL Argenteuil)`);
        console.log(`  - U3MriTZbPbTUEsU6RtRuHxDMKvg2 (existing)`);
        console.log('\n========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ SCRIPT FAILED:', error.message);
        process.exit(1);
    }
}

main();
