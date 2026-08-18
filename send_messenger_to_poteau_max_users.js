const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// Messages in 4 languages
const messages = {
    fr: (displayName) => `Salut l'équipe ${displayName},

Comme vous l'avez sans doute vu, on a publié une mise à jour de Poteau Max, la première depuis un moment !

Les nouveautés :

🎾 Le padel débarque : créez vos matchs foot & padel en deux secondes.

💬 Messages pré-enregistrés : enregistrez une fois, gagnez du temps à chaque match.

🔄 Multicompte : passez d'un centre à l'autre instantanément.

😎 Réactions & emojis : rendez le chat plus vivant que jamais.

👤 Nouvelle fiche joueur : retrouvez toutes les infos utiles, plus appel/SMS en un clic.

🔍 Recherche boostée : retrouvez n'importe quel joueur (nom, email, téléphone).

✨ Design affiné + blocage de place simplifié : tout va plus vite.

N'hésitez pas à nous poser vos questions si vous avez des soucis ou des suggestions ou juste si la nouvelle version vous plaît, ça fait toujours plaisir.

À bientôt !

L'équipe Poteau Max`,

    en: (displayName) => `Hey team ${displayName},

As you may have noticed, we've just released an update for Poteau Max, the first one in a while – we're excited about it!

What's new:

🎾 Padel is here: create your football & padel matches in two seconds.

💬 Pre-saved messages: save once, save time on every match.

🔄 Multi-account: switch between centres instantly.

😎 Reactions & emojis: make the chat more lively than ever.

👤 New player card: find all the useful info, plus call/SMS in one tap.

🔍 Boosted search: find any player (name, email, phone).

✨ Refined design + simplified spot blocking: everything is faster.

Feel free to reach out if you have any issues, suggestions, or just to let us know if you like the new version – we always love hearing from you.

See you soon!

The Poteau Max Team`,

    es: (displayName) => `¡Hola equipo ${displayName}!

Como quizás habéis visto, acabamos de publicar una actualización de Poteau Max, la primera desde hace tiempo, ¡qué ilusión!

Las novedades:

🎾 Llega el pádel: cread vuestros partidos de fútbol y pádel en dos segundos.

💬 Mensajes pregrabados: guardad una vez, ahorrad tiempo en cada partido.

🔄 Multicuenta: cambiad de centro instantáneamente.

😎 Reacciones y emojis: haced el chat más animado que nunca.

👤 Nueva ficha de jugador: encontrad toda la info útil, más llamada/SMS en un clic.

🔍 Búsqueda mejorada: encontrad cualquier jugador (nombre, email, teléfono).

✨ Diseño refinado + bloqueo de plaza simplificado: todo va más rápido.

No dudéis en escribirnos si tenéis dudas, sugerencias o simplemente para decirnos si os gusta la nueva versión, siempre nos alegra saberlo.

¡Hasta pronto!

El equipo Poteau Max`,

    it: (displayName) => `Ciao team ${displayName}!

Come forse avete visto, abbiamo appena rilasciato un aggiornamento di Poteau Max, il primo da un po' di tempo – siamo entusiasti!

Le novità:

🎾 Arriva il padel: create le vostre partite di calcio e padel in due secondi.

💬 Messaggi preregistrati: salvate una volta, risparmiate tempo a ogni partita.

🔄 Multi-account: passate da un centro all'altro istantaneamente.

😎 Reazioni ed emoji: rendete la chat più vivace che mai.

👤 Nuova scheda giocatore: trovate tutte le info utili, più chiamata/SMS in un tap.

🔍 Ricerca potenziata: trovate qualsiasi giocatore (nome, email, telefono).

✨ Design raffinato + blocco posto semplificato: tutto è più veloce.

Non esitate a contattarci se avete domande, suggerimenti o semplicemente per dirci se vi piace la nuova versione, ci fa sempre piacere.

A presto!

Il team Poteau Max`
};

async function sendMessengerToAllPoteauMaxUsers() {
    try {
        console.log('🚀 Starting to send messages to all Poteau Max users...\n');

        // Query all pro users
        const usersSnapshot = await db.collection('users')
            .where('type', '==', 'pro')
            .get();

        if (usersSnapshot.empty) {
            console.log('❌ No Poteau Max users found.');
            return;
        }

        console.log(`📋 Found ${usersSnapshot.size} Poteau Max users.\n`);

        let successCount = 0;
        let errorCount = 0;
        const sentAt = admin.firestore.FieldValue.serverTimestamp();

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const displayName = userData.display_name || userData.centre_name || 'there';
            const language = userData.language || 'fr';

            // Get the message in the user's language, default to French
            const getMessage = messages[language] || messages['fr'];
            const messageText = getMessage(displayName);

            try {
                // Create messenger document
                const messengerRef = db.collection('messenger').doc();
                await messengerRef.set({
                    text: messageText,
                    sent_at: sentAt,
                    conversation_with: db.doc(`users/${userId}`),
                    sender: 'poteau',
                });

                // Update user's centre_unread_messenger count
                await db.collection('users').doc(userId).update({
                    centre_unread_messenger: admin.firestore.FieldValue.increment(1),
                });

                successCount++;
                console.log(`✅ [${successCount}/${usersSnapshot.size}] Sent to ${displayName} (${language}) - ${userId}`);
            } catch (error) {
                errorCount++;
                console.error(`❌ Error sending to ${displayName} (${userId}):`, error.message);
            }
        }

        console.log('\n========================================');
        console.log('📊 SUMMARY');
        console.log('========================================');
        console.log(`✅ Successfully sent: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📋 Total users: ${usersSnapshot.size}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('❌ Fatal error:', error);
    }
}

// Dry run function to preview users without sending
async function dryRun() {
    try {
        console.log('🔍 DRY RUN - Previewing Poteau Max users...\n');

        const usersSnapshot = await db.collection('users')
            .where('type', '==', 'pro')
            .get();

        if (usersSnapshot.empty) {
            console.log('❌ No pro users found.');
            return;
        }

        console.log(`📋 Found ${usersSnapshot.size} pro users:\n`);

        const languageCounts = { fr: 0, en: 0, es: 0, it: 0, other: 0 };

        usersSnapshot.docs.forEach((doc, index) => {
            const userData = doc.data();
            const displayName = userData.display_name || userData.centre_name || 'N/A';
            const language = userData.language || 'fr';
            const email = userData.email || 'N/A';

            if (languageCounts[language] !== undefined) {
                languageCounts[language]++;
            } else {
                languageCounts.other++;
            }

            console.log(`${index + 1}. ${displayName}`);
            console.log(`   Email: ${email}`);
            console.log(`   Language: ${language}`);
            console.log(`   ID: ${doc.id}`);
            console.log('');
        });

        console.log('========================================');
        console.log('📊 LANGUAGE DISTRIBUTION');
        console.log('========================================');
        console.log(`🇫🇷 French (fr): ${languageCounts.fr}`);
        console.log(`🇬🇧 English (en): ${languageCounts.en}`);
        console.log(`🇪🇸 Spanish (es): ${languageCounts.es}`);
        console.log(`🇮🇹 Italian (it): ${languageCounts.it}`);
        console.log(`🌍 Other: ${languageCounts.other}`);
        console.log('========================================\n');

        // Preview messages for each language
        console.log('========================================');
        console.log('📝 MESSAGE PREVIEWS');
        console.log('========================================\n');

        const previewLanguages = ['fr', 'en', 'es', 'it'];
        for (const lang of previewLanguages) {
            const flag = { fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', it: '🇮🇹' }[lang];
            console.log(`${flag} ${lang.toUpperCase()} MESSAGE:`);
            console.log('----------------------------------------');
            console.log(messages[lang]('[NOM DU CENTRE]'));
            console.log('\n========================================\n');
        }

    } catch (error) {
        console.error('❌ Error during dry run:', error);
    }
}

// Test function to send to a single user
async function testSend() {
    const testUserId = 'zCvsukfMuuffsuPpSTQwb7MusMD2';

    try {
        console.log('🧪 TEST MODE - Sending to test user only...\n');

        const userDoc = await db.collection('users').doc(testUserId).get();

        if (!userDoc.exists) {
            console.log(`❌ Test user ${testUserId} not found.`);
            return;
        }

        const userData = userDoc.data();
        const displayName = userData.display_name || userData.centre_name || 'there';
        const language = userData.language || 'fr';

        const getMessage = messages[language] || messages['fr'];
        const messageText = getMessage(displayName);

        console.log(`📋 Test user: ${displayName}`);
        console.log(`   Language: ${language}`);
        console.log(`   ID: ${testUserId}\n`);

        console.log('📝 Message to be sent:');
        console.log('----------------------------------------');
        console.log(messageText);
        console.log('----------------------------------------\n');

        const sentAt = admin.firestore.FieldValue.serverTimestamp();

        // Create messenger document
        const messengerRef = db.collection('messenger').doc();
        await messengerRef.set({
            text: messageText,
            sent_at: sentAt,
            conversation_with: db.doc(`users/${testUserId}`),
            sender: 'poteau',
        });

        // Update user's centre_unread_messenger count
        await db.collection('users').doc(testUserId).update({
            centre_unread_messenger: admin.firestore.FieldValue.increment(1),
        });

        console.log(`✅ Test message sent successfully to ${displayName}!`);

    } catch (error) {
        console.error('❌ Error during test send:', error);
    }
}

// Check command line argument
const args = process.argv.slice(2);

if (args.includes('--dry-run') || args.includes('-d')) {
    dryRun().then(() => process.exit(0));
} else if (args.includes('--test') || args.includes('-t')) {
    testSend().then(() => process.exit(0));
} else if (args.includes('--send') || args.includes('-s')) {
    sendMessengerToAllPoteauMaxUsers().then(() => process.exit(0));
} else {
    console.log('📬 Poteau Max Messenger Broadcast Script');
    console.log('========================================\n');
    console.log('Usage:');
    console.log('  node send_messenger_to_poteau_max_users.js --dry-run  (or -d)  Preview users without sending');
    console.log('  node send_messenger_to_poteau_max_users.js --test     (or -t)  Send to test user only');
    console.log('  node send_messenger_to_poteau_max_users.js --send     (or -s)  Send messages to all users');
    console.log('');
    process.exit(0);
}
