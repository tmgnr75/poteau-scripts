const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

async function createCentreUser(data) {
    try {
        console.log('🚀 Starting user creation process...');

        // Ensure display_name and centre_name are the same
        const centre_name = data.centre_name;
        const display_name = centre_name;

        console.log('✅ Input data validation complete.');

        // Step 1: Create Firebase Authentication User
        console.log('➡️ Creating Firebase Authentication user...');
        const userRecord = await admin.auth().createUser({
            email: data.email,
            displayName: display_name,
            photoURL: data.photo_url || null, // Default to null if undefined
        });
        const uid = userRecord.uid;
        console.log(`✅ Firebase Authentication user created successfully. UID: ${uid}`);

        // Step 2: Prepare Firestore Data
        console.log('➡️ Preparing Firestore data...');
        const created_time = new Date();
        const firestoreData = {
            centre_address: data.centre_address,
            centre_country: data.centre_country,
            centre_currency: data.centre_currency,
            centre_football_fields: data.centre_football_fields,
            centre_location: new admin.firestore.GeoPoint(
                parseFloat(data.centre_location.lat),
                parseFloat(data.centre_location.lng)
            ),
            centre_name,
            centre_payment_type: data.centre_payment_type,
            centre_place_id: data.centre_place_id,
            centre_plan_next_renew: new Date(data.centre_plan_next_renew),
            centre_plan_status: data.centre_plan_status,
            centre_poster: data.centre_poster,
            centre_poteau_max: data.centre_poteau_max,
            centre_share_onsite: data.centre_share_onsite,
            centre_unread_messenger: data.centre_unread_messenger,
            centre_user_first_name: data.centre_user_first_name,
            centre_user_gender: data.centre_user_gender,
            centre_user_last_name: data.centre_user_last_name,
            centre_user_role: data.centre_user_role,
            created_time,
            display_name,
            email: data.email,
            hash_pic: data.hash_pic,
            language: data.language,
            last_activity_date: created_time,
            last_messenger: created_time,
            last_onboarding_step: data.last_onboarding_step,
            photo_url: data.photo_url || null, // Default to null if undefined
            short_name: data.short_name,
            time_zone: data.time_zone,
            type: data.type,
            revenue_since_1st: 0,
            organized_since_1st: 0,
            played_since_1st: 0,
            uid,
        };
        console.log('✅ Firestore data prepared successfully:', JSON.stringify(firestoreData, null, 2));

        // Step 3: Write Data to Firestore
        console.log('➡️ Writing user data to Firestore...');
        await db.collection('users').doc(uid).set(firestoreData);
        console.log(`✅ Firestore document created successfully for UID: ${uid}`);

        // Step 4: Create default custom message
        console.log('➡️ Creating default custom message...');
        const customMessageTranslations = {
            fr: {
                title: "Exemple de message personnalisé",
                content: "Voici le genre de message que vous pouvez préparer et envoyer en un clic sur Poteau Max"
            },
            en: {
                title: "Custom message example",
                content: "Here's the kind of message you can prepare and send with one click on Poteau Max"
            },
            es: {
                title: "Ejemplo de mensaje personalizado",
                content: "Este es el tipo de mensaje que puede preparar y enviar con un solo clic en Poteau Max"
            },
            it: {
                title: "Esempio di messaggio personalizzato",
                content: "Ecco il tipo di messaggio che puoi preparare e inviare con un clic su Poteau Max"
            }
        };
        const userLang = data.language?.toLowerCase() || 'fr';
        const translation = customMessageTranslations[userLang] || customMessageTranslations['fr'];
        const customMessageData = {
            created: admin.firestore.FieldValue.serverTimestamp(),
            last_edited_time: admin.firestore.FieldValue.serverTimestamp(),
            last_edited_by: uid,
            title: translation.title,
            content: translation.content,
            user_id: uid
        };
        const customMessageRef = await db.collection('custom_messages').add(customMessageData);
        console.log(`✅ Default custom message created: custom_messages/${customMessageRef.id}`);

        console.log('🎉 User creation process completed successfully!');
    } catch (error) {
        console.error('❌ Error during user creation process:', error.message);
        console.error(error);
    }
}

// Input Data
const inputData = {
    centre_country: "France",
    centre_currency: "EUR",
    centre_name: "Athletic Arena",
    centre_location: { lat: "46.802302", lng: "4.4513177" },
    centre_address: "14 Rue Albert Camus, 71200 Le Creusot",
    centre_place_id: "ChIJOXE_fJ9N8kcRnbiR9pBVDdY",
    email: "contact@athleticarena.fr",
    centre_user_first_name: "Florian",
    centre_user_last_name: "Courrège",
    short_name: "athletic-arena",
    photo_url: "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2FLogo-Athetic-Arena-blanc.png?alt=media&token=4ad2be28-4131-4ce6-9599-e2c603b86d6d",
    hash_pic: "KGBM_PWB9F00ofIU~qWBxu",
    centre_football_fields: 4,
    language: "fr",
    centre_poteau_max: false,
    last_onboarding_step: "complete",
    time_zone: "Europe/Paris",
    centre_plan_status: "active",
    centre_plan_next_renew: "2026-11-01",
    centre_payment_type: "on-site",
    type: "pro",
    centre_user_gender: "man",
    centre_user_role: "owner",
    centre_unread_messenger: 0,
    // centre_poster: "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/posters%2Fpdf-lab-five-los-angeles.pdf?alt=media&token=e9cf1c02-6958-457b-9d4a-f27cd54475c1",
};

createCentreUser(inputData);