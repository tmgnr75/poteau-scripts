/**
 * Send the Poteau Max welcome messenger message to RealFive Pont-à-Mousson.
 *
 * Every partner centre gets this as their first in-app message right after
 * their account is created. It is what the welcome email refers to with
 * "On t'a envoyé un message avec des infos sur l'appli, tu verras 😉".
 *
 * Text follows sendWelcomeMessengerLeParkServon.js, itself following Soccer
 * Arena 13, In'Sport (2025-05-28) and Athletic Arena (2025-10-13).
 *
 * WHY THE MIDDLE PARAGRAPH IS DIFFERENT FROM LE PARK'S
 * -----------------------------------------------------
 * Le Park's message named its existing demand: 469 games already played at
 * the venue, 591 players holding alerts, and the top slot. That paragraph was
 * the whole point of the message, because telling a centre with a live market
 * to go build one would have read as a form letter.
 *
 * RealFive is the opposite case and the same paragraph would be a lie.
 * Measured 2026-09-14 against the confirmed coordinates:
 *
 *   - 0 games ever organized within 15 km
 *   - 0 alerts on the place_id
 *   - 48 players whose availabilities radius reaches the venue, 23 with a
 *     time slot ticked, 19 active in the last 90 days
 *   - 0 of those 48 has ever played a game on Poteau
 *
 * So the message quotes the 48, and says plainly that they have not played
 * yet. Quoting them as if they were a waiting crowd would set Fares up to feel
 * cheated in three weeks, which is worse than saying the true, smaller thing.
 *
 * The centre's own asset is its 300 declared customers (application form,
 * 2026-09-13). That is what the message leads on: Poteau fills HIS slots with
 * HIS players first, and the Poteau side grows from there.
 *
 * WHAT THE MESSAGE DELIBERATELY DOES NOT MENTION
 * -----------------------------------------------
 * The website integration he ticked on the form. Confirmed with Tim
 * 2026-09-14: it is a conversation for once he has published, not part of a
 * welcome. Mentioning it here would invite a question we are not ready to
 * answer and bury the one action that matters (publish a first game).
 *
 * Doc shape matches send_messenger_to_poteau_max_users.js: four fields plus a
 * manual centre_unread_messenger increment so the badge shows in the app.
 * `last_messenger` is NOT set here - the updateLastMessenger Cloud Function
 * (onCreate on messenger/{id}) writes it automatically.
 *
 * Idempotent: aborts if a message from Poteau already exists in the thread.
 *
 * Run:
 *   node sendWelcomeMessengerRealFive.js --uid <uid> --dry-run   preview only
 *   node sendWelcomeMessengerRealFive.js --uid <uid> --send      actually send
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const CENTRE_NAME = 'RealFive Pont-à-Mousson';
const CONTACT_FIRST_NAME = 'Fares';
const SIGN_OFF = "L'équipe Poteau";

// Measured 2026-09-14. Recheck before reusing this text months later.
const PLAYERS_IN_RANGE = 48;
const BEST_SLOT = 'le samedi à 19h30';

const TEXT = `Salut ${CONTACT_FIRST_NAME} et bienvenue sur Poteau Max, on est très contents de t'accueillir et on a hâte de voir le RealFive tourner à plein.

Poteau Max, c'est l'appli officielle pour nos centres partenaires : ici tu peux organiser des matchs hebdos (qui se répèteront chaque semaine à la même heure, au même prix, automatiquement) : ils s'affichent sur l'appli Poteau pour les joueurs.

Le plus efficace au début, c'est de remplir tes créneaux avec tes joueurs à toi. Tu publies ton match, tu partages le lien, ils s'inscrivent en deux clics et tu vois la liste se remplir en direct. Pas besoin de relancer tout le monde un par un.

En parallèle, ${PLAYERS_IN_RANGE} joueurs autour de Pont-à-Mousson ont indiqué leurs disponibilités sur Poteau et ton centre est dans leur zone. Aucun n'a encore joué chez toi, c'est à construire, mais ils sont là et le créneau qui revient le plus souvent chez eux, c'est ${BEST_SLOT}. Tu retrouveras le détail jour par jour dans l'appli.

Si tu as la moindre question n'hésite pas, on est dispo par chat 24h/24, 7j/7 !

${SIGN_OFF}`;

function resolveUid() {
    const index = process.argv.indexOf('--uid');
    if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
    return process.env.REALFIVE_UID || null;
}

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send') || args.includes('-s');
    const dryRun = args.includes('--dry-run') || args.includes('-d');

    if (!send && !dryRun) {
        console.log('Usage:');
        console.log('  node sendWelcomeMessengerRealFive.js --uid <uid> --dry-run   preview only');
        console.log('  node sendWelcomeMessengerRealFive.js --uid <uid> --send      actually send');
        process.exit(1);
    }

    const uid = resolveUid();
    if (!uid) {
        console.error('Missing uid. Pass --uid <uid>, printed by createRealFivePontAMousson.js --write.');
        process.exit(1);
    }

    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error(`User ${uid} not found.`);
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

    console.log(`\nRecipient : ${CENTRE_NAME} (${uid})`);
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
