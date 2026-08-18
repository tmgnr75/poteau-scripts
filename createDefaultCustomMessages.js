const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Translations for the default custom message
const TRANSLATIONS = {
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

// Default language if user's language is not supported
const DEFAULT_LANGUAGE = 'fr';

/**
 * Get the appropriate translation based on user's language
 */
function getTranslation(userLanguage) {
    const lang = userLanguage?.toLowerCase() || DEFAULT_LANGUAGE;
    return TRANSLATIONS[lang] || TRANSLATIONS[DEFAULT_LANGUAGE];
}

/**
 * Check if a user already has custom messages
 */
async function userHasCustomMessages(userId) {
    const snapshot = await db.collection('custom_messages')
        .where('user_id', '==', userId)
        .limit(1)
        .get();
    return !snapshot.empty;
}

/**
 * Create a default custom message for a user
 */
async function createCustomMessage(userId, displayName, language) {
    const translation = getTranslation(language);
    const now = admin.firestore.FieldValue.serverTimestamp();

    const messageData = {
        created: now,
        last_edited_time: now,
        last_edited_by: userId,
        title: translation.title,
        content: translation.content,
        user_id: userId
    };

    const docRef = await db.collection('custom_messages').add(messageData);
    return docRef.id;
}

async function main() {
    const startTime = Date.now();
    console.log('='.repeat(80));
    console.log('[START] Creating default custom messages for pro users');
    console.log(`[INFO] Script started at: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

    // Stats
    const stats = {
        totalProUsers: 0,
        alreadyHaveMessages: 0,
        messagesCreated: 0,
        errors: 0,
        byLanguage: { fr: 0, en: 0, es: 0, it: 0 }
    };

    try {
        // Step 1: Fetch all pro users
        console.log('\n[STEP 1] Fetching all pro users from Firestore...');
        const proUsersSnapshot = await db.collection('users')
            .where('type', '==', 'pro')
            .get();

        stats.totalProUsers = proUsersSnapshot.size;
        console.log(`[INFO] Found ${stats.totalProUsers} pro users`);

        if (proUsersSnapshot.empty) {
            console.log('[WARN] No pro users found. Exiting.');
            return;
        }

        // Step 2: Process each pro user
        console.log('\n[STEP 2] Processing pro users...');
        console.log('-'.repeat(80));

        for (const userDoc of proUsersSnapshot.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const displayName = userData.display_name || 'Unknown';
            const language = userData.language || DEFAULT_LANGUAGE;
            const centreName = userData.centre_name || 'N/A';

            console.log(`\n[USER] ${displayName} (ID: ${userId})`);
            console.log(`       Centre: ${centreName}`);
            console.log(`       Language: ${language}`);

            try {
                // Check if user already has custom messages
                const hasMessages = await userHasCustomMessages(userId);

                if (hasMessages) {
                    console.log(`       [SKIP] User already has custom messages`);
                    stats.alreadyHaveMessages++;
                    continue;
                }

                // Create the default custom message
                const translation = getTranslation(language);
                console.log(`       [CREATE] Creating message in ${language}...`);
                console.log(`       Title: "${translation.title}"`);

                const docId = await createCustomMessage(userId, displayName, language);

                console.log(`       [SUCCESS] Created custom_messages/${docId}`);
                stats.messagesCreated++;

                // Track by language
                const langKey = TRANSLATIONS[language] ? language : DEFAULT_LANGUAGE;
                stats.byLanguage[langKey]++;

            } catch (error) {
                console.error(`       [ERROR] Failed to process user: ${error.message}`);
                stats.errors++;
            }
        }

        // Step 3: Summary
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('[SUMMARY]');
        console.log('='.repeat(80));
        console.log(`Total pro users found:       ${stats.totalProUsers}`);
        console.log(`Already had messages:        ${stats.alreadyHaveMessages}`);
        console.log(`Messages created:            ${stats.messagesCreated}`);
        console.log(`Errors:                      ${stats.errors}`);
        console.log('-'.repeat(40));
        console.log('Messages by language:');
        console.log(`  - French (fr):             ${stats.byLanguage.fr}`);
        console.log(`  - English (en):            ${stats.byLanguage.en}`);
        console.log(`  - Spanish (es):            ${stats.byLanguage.es}`);
        console.log(`  - Italian (it):            ${stats.byLanguage.it}`);
        console.log('-'.repeat(40));
        console.log(`Duration:                    ${duration}s`);
        console.log(`Completed at:                ${new Date().toISOString()}`);
        console.log('='.repeat(80));

    } catch (error) {
        console.error('\n[FATAL ERROR]', error);
    } finally {
        await admin.app().delete();
        console.log('\n[END] Firebase connection closed');
    }
}

main();
