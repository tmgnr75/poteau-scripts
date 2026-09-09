/**
 * Send the Poteau Max welcome messenger message to LE PARK Servon.
 *
 * Every partner centre gets this as their first in-app message right after
 * their account is created. It is what the welcome email refers to with
 * "On t'a envoyé un message avec des infos sur l'appli, tu verras 😉".
 *
 * Text follows sendWelcomeMessengerSoccerArena13.js, itself following the
 * In'Sport (2025-05-28) and Athletic Arena (2025-10-13) template, varying the
 * contact name and the local demonym.
 *
 * TWO DELIBERATE DEPARTURES FROM THAT TEMPLATE
 * --------------------------------------------
 * 1. Signed "L'équipe Poteau", not "Ben". The three earlier welcome messages
 *    are signed with a first name, which breaks the Poteau voice rule (never
 *    an individual name). Confirmed with Tim on 2026-09-09 for this send.
 *
 * 2. One extra paragraph, specific to this centre. The standard text promises
 *    the centre will build a community. Le Park already has one: 469 games at
 *    this place_id since Sep 2023, 247 unique players, and 645 alerts from 591
 *    distinct players pointing at it. Telling Emmanuel to go build what he
 *    already has would read as a form letter, so the message names the demand
 *    instead - including the top slot, the single most actionable thing he can
 *    act on today.
 *
 *    The message says 591 players, not 645: 645 is the alert count, and one
 *    player can hold several. Quote the people, not the docs.
 *
 * Doc shape matches send_messenger_to_poteau_max_users.js: four fields plus a
 * manual centre_unread_messenger increment so the badge shows in the app.
 * `last_messenger` is NOT set here - the updateLastMessenger Cloud Function
 * (onCreate on messenger/{id}) writes it automatically.
 *
 * Idempotent: aborts if a message from Poteau already exists in the thread.
 *
 * Run:
 *   node sendWelcomeMessengerLeParkServon.js --dry-run   preview only
 *   node sendWelcomeMessengerLeParkServon.js --send      actually send
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const UID = 'VeBdqhGJRZSOrajilg8pefl2PEk1';
const CENTRE_NAME = 'LE PARK Servon';
const CONTACT_FIRST_NAME = 'Emmanuel';
const DEMONYM = 'Servonnais'; // residents of Servon (77170)
const SIGN_OFF = "L'équipe Poteau";

const TEXT = `Salut ${CONTACT_FIRST_NAME} et bienvenue sur Poteau Max, on est très contents de t'accueillir et on a hâte de voir les ${DEMONYM} jouer au foot plus souvent grâce à ton centre.

Poteau Max, c'est l'appli officielle pour nos centres partenaires : ici tu peux organiser des matchs hebdos (qui se répèteront chaque semaine à la même heure, au même prix, automatiquement) : ils s'affichent sur l'appli Poteau pour les joueurs.

Un point qui te concerne directement : des joueurs organisent déjà leurs matchs chez toi sur Poteau, et 591 joueurs ont posé une alerte sur ton centre pour être prévenus dès qu'un match s'y ouvre. Le créneau le plus attendu est le dimanche à 20h. Tu retrouveras le détail jour par jour dans l'appli.

En développant ta communauté, ils rempliront leurs dispos et tu sauras combien de joueurs seront automatiquement invités à tes matchs pour chaque créneau 🔥

Si tu as la moindre question n'hésite pas, on est dispo par chat 24h/24, 7j/7 !

${SIGN_OFF}`;

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send') || args.includes('-s');
    const dryRun = args.includes('--dry-run') || args.includes('-d');

    if (!send && !dryRun) {
        console.log('Usage:');
        console.log('  node sendWelcomeMessengerLeParkServon.js --dry-run   preview only');
        console.log('  node sendWelcomeMessengerLeParkServon.js --send      actually send');
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
