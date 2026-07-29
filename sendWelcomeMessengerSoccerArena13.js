/**
 * Send the Poteau Max welcome messenger message to Soccer Arena 13.
 *
 * Every partner centre gets this as their first in-app message right after
 * their account is created. It is what the welcome email refers to with
 * "On t'a envoyé un message avec des infos sur l'appli, tu verras 😉".
 *
 * Text follows the template used for In'Sport (2025-05-28) and Athletic Arena
 * (2025-10-13), varying only the contact name, the local demonym and the
 * sign-off.
 *
 * Doc shape matches send_messenger_to_poteau_max_users.js: four fields plus a
 * manual centre_unread_messenger increment so the badge shows in the app.
 * `last_messenger` is NOT set here - the updateLastMessenger Cloud Function
 * (onCreate on messenger/{id}) writes it automatically.
 *
 * Idempotent: aborts if a message from Poteau already exists in the thread.
 *
 * Run:
 *   node sendWelcomeMessengerSoccerArena13.js --dry-run   preview only
 *   node sendWelcomeMessengerSoccerArena13.js --send      actually send
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const UID = 'Jmd7OmNaMwYhDEyGVYyeq7oxODC2';
const CENTRE_NAME = 'Soccer Arena 13';
const CONTACT_FIRST_NAME = 'Philippe';
const DEMONYM = 'Saint-Cannadéens'; // residents of Saint-Cannat (13760)
const SIGN_OFF = 'Ben';

const TEXT = `Salut ${CONTACT_FIRST_NAME} et bienvenue sur Poteau Max, on est très contents de t'accueillir et on a hâte de voir les ${DEMONYM} jouer au foot plus souvent grâce à ton centre.

Poteau Max, c'est l'appli officielle pour nos centres partenaires : ici tu peux organiser des matchs hebdos (qui se répèteront chaque semaine à la même heure, au même prix, automatiquement) : ils s'affichent sur l'appli Poteau pour les joueurs.

En développant ta communauté, ils rempliront leurs dispos et tu sauras combien de joueurs seront automatiquement invités à tes matchs pour chaque créneau 🔥

Si tu as la moindre question n'hésite pas, on est dispo par chat 24h/24, 7j/7 !

${SIGN_OFF}`;

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send') || args.includes('-s');
    const dryRun = args.includes('--dry-run') || args.includes('-d');

    if (!send && !dryRun) {
        console.log('Usage:');
        console.log('  node sendWelcomeMessengerSoccerArena13.js --dry-run   preview only');
        console.log('  node sendWelcomeMessengerSoccerArena13.js --send      actually send');
        process.exit(1);
    }

    const userRef = db.collection('users').doc(UID);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error(`User ${UID} not found.`);
    if (userSnap.get('centre_name') !== CENTRE_NAME) {
        throw new Error(`Expected ${CENTRE_NAME}, found ${userSnap.get('centre_name')}. Aborting.`);
    }

    // Don't double-send if a Poteau message is already in the thread.
    const existing = await db
        .collection('messenger')
        .where('conversation_with', '==', userRef)
        .get();
    const fromPoteau = existing.docs.filter((d) => d.data().sender === 'poteau');
    if (fromPoteau.length > 0) {
        console.log(
            `⚠️  ${fromPoteau.length} message(s) from Poteau already exist in this thread. Aborting.`
        );
        process.exit(1);
    }

    console.log(`\nRecipient : ${CENTRE_NAME} (${UID})`);
    console.log(`Email     : ${userSnap.get('email')}`);
    console.log(`Unread now: ${userSnap.get('centre_unread_messenger')}`);
    console.log('\n--- MESSAGE ---');
    console.log(TEXT);
    console.log('--- END ---\n');

    if (dryRun) {
        console.log('🔍 Dry run, nothing written.');
        process.exit(0);
    }

    const sentAt = admin.firestore.Timestamp.now();
    const messengerRef = db.collection('messenger').doc();
    await messengerRef.set({
        text: TEXT,
        sent_at: sentAt,
        conversation_with: userRef,
        sender: 'poteau',
    });
    await userRef.update({
        centre_unread_messenger: admin.firestore.FieldValue.increment(1),
    });

    console.log(`✅ Sent. messenger/${messengerRef.id}`);
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
