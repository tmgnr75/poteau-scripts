const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function main() {
    try {
        const leFiveColombesUid = 'nkME2s5zOrP9Boid6uPgOz1Ssfi1';
        const fourPadelArgenteuiUid = 'gYGkBpA9N0OhLOKlgXx9ja96UA73';

        console.log('\n========================================');
        console.log('Creating ADMIN USER: Virginie Renouf');
        console.log('========================================\n');

        const display_name = 'Virginie Renouf';

        const photo_url = 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2F1669306977192%20(1)%20(1).jpeg?alt=media&token=fbdc6c53-3f02-4c74-81c0-bc03b20fe785';

        // Step 1: Create Firebase Authentication User
        console.log('➡️ Creating Firebase Authentication user...');
        const userRecord = await admin.auth().createUser({
            email: 'virginie.renouf@lefive.fr',
            displayName: display_name,
            photoURL: photo_url,
        });
        const uid = userRecord.uid;
        console.log(`✅ Firebase Authentication user created. UID: ${uid}`);

        // Step 2: Prepare Firestore Data
        const created_time = new Date();
        const firestoreData = {
            // Core Identity
            uid,
            email: 'virginie.renouf@lefive.fr',
            display_name,
            type: 'super_pro',
            photo_url,
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
            centre_share_onsite: false,

            // Optional
            centre_poster: null,
            phone_number: null,
            centre_fff: false,
            centre_gold_default: false,

            // Accounts array - linking to the centres she manages
            accounts: [
                leFiveColombesUid,
                fourPadelArgenteuiUid,
                'U3MriTZbPbTUEsU6RtRuHxDMKvg2',
            ],

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

        // Summary
        console.log('\n========================================');
        console.log('🎉 VIRGINIE RENOUF CREATED SUCCESSFULLY!');
        console.log('========================================');
        console.log(`\nVirginie Renouf UID: ${uid}`);
        console.log('\nAccounts array:');
        console.log(`  - ${leFiveColombesUid} (LE FIVE Colombes)`);
        console.log(`  - ${fourPadelArgenteuiUid} (4PADEL Argenteuil)`);
        console.log(`  - U3MriTZbPbTUEsU6RtRuHxDMKvg2 (existing)`);
        console.log('\n========================================\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main();
