/**
 * Poteau | One-off moderation: red card + ban for two players on game
 * NSVNXEDR9TelJPw9o438 (LE FIVE Bezons, 2026-08-20), plus a Poteau team
 * message in the game chat.
 *
 * WHY A DIRECT RED ON THE FIRST CARD
 * Neither player had a standing card, so the ladder would have given a yellow.
 * A moderator's red overrides the ladder when the offence is severe on its own
 * (MODERATION.md, "The red button bans on the first card"). Here the game chat
 * carries ~40 messages of mutual insults escalating to explicit threats of
 * physical violence and homophobic abuse, from both accounts, continuing for
 * two days after the game. Both were independently marked in the game's
 * `rude_players` by other attendees.
 *
 * Reason is `harassment_abuse`, which is the vocabulary shared with
 * `user_reports.reason`. There is no report doc: this came to us directly, so
 * `reportRef` stays null and `issuedBy` records who decided.
 *
 * Uses shared/cards.js issueCard rather than writing `banned` by hand, so both
 * players land on the same ladder as every other card, with history, push and
 * chat message. Do NOT hand-roll the discipline fields.
 *
 * Usage:
 *   node card_geordy_esteban_2026-08-24.js --dry
 *   node card_geordy_esteban_2026-08-24.js --write
 */
const path = require('path');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

// issueCard lives in the functions repo and calls admin.firestore() itself,
// which is why initializeApp has to happen before this require resolves.
const FUNCTIONS = path.join(__dirname, '..', 'cloud-functions', 'functions');

// scripts/ and cloud-functions/functions/ each have their OWN firebase-admin in
// node_modules, so they are two different module instances with two different
// app registries. cards.js calls admin.firestore() on ITS copy, which knows
// nothing about the initializeApp() above and throws app/no-app. Initialise the
// functions-side instance as well before requiring cards.js.
const fnAdmin = require(path.join(FUNCTIONS, 'node_modules', 'firebase-admin'));
if (!fnAdmin.apps.length) {
    fnAdmin.initializeApp({
        credential: fnAdmin.credential.cert(serviceAccount),
        projectId: 'krank-club',
    });
}

// EVERY DocumentReference handed to issueCard must be built from THIS instance.
// Firestore rejects a ref created by a different firebase-admin copy with
// "Detected an object of type DocumentReference that doesn't match the expected
// instance". cards.js swallows its own write errors by design, so passing the
// scripts-side ref does NOT fail loudly -- it silently drops the card history,
// the push and the chat message while still banning the user.
const fnDb = fnAdmin.firestore();

const { issueCard, SOURCE_MODERATOR } = require(path.join(FUNCTIONS, 'shared', 'cards.js'));

const GAME_ID = 'NSVNXEDR9TelJPw9o438';
const ISSUED_BY = 'tim';
const REASON = 'harassment_abuse';

const TARGETS = [
    { uid: '8bUFe1hkmuRyNeJWeJoBbiDUSKG3', name: 'Esteban Di Maria' },
    { uid: 'BQASlhA8TcbkPCGSc3Fyypo23VG2', name: 'Geordy Vtx' },
];

// Spoken to the whole game, as the Poteau team. Deliberately names nobody and
// repeats none of what was said: the two card messages issueCard posts already
// name each player and their card. This one addresses the group.
const TEAM_MESSAGE = {
    text: "Les échanges sur ce match sont allés beaucoup trop loin. Deux joueurs ont reçu un carton rouge et leur accès à l'app est bloqué. Poteau, c'est du sport entre gens qui se respectent, et les insultes comme les menaces n'y ont pas leur place. Merci à ceux qui ont essayé de calmer les choses.",
    text_en: "The exchanges on this game went far too far. Two players have received a red card and their access to the app is blocked. Poteau is sport between people who respect each other, and insults and threats have no place here. Thanks to those who tried to calm things down.",
    text_es: "Los intercambios en este partido fueron demasiado lejos. Dos jugadores han recibido tarjeta roja y su acceso a la app está bloqueado. Poteau es deporte entre personas que se respetan, y los insultos y las amenazas no tienen cabida aquí. Gracias a quienes intentaron calmar las cosas.",
    text_it: "Gli scambi su questa partita sono andati troppo oltre. Due giocatori hanno ricevuto un cartellino rosso e il loro accesso all'app è bloccato. Poteau è sport tra persone che si rispettano, e insulti e minacce non hanno posto qui. Grazie a chi ha provato a calmare le cose.",
};

const WRITE = process.argv.includes('--write');

async function main() {
    console.log(`[START] mode=${WRITE ? 'WRITE' : 'DRY'} game=${GAME_ID}`);

    const gameRef = db.collection('games').doc(GAME_ID);
    const gameSnap = await gameRef.get();
    if (!gameSnap.exists) throw new Error(`Game ${GAME_ID} not found`);
    const game = gameSnap.data();
    console.log(`[GAME] ${game.centre} | ${game.date.toDate().toISOString()} | ${game.status}`);

    // Guard: only card players who were actually on this roster.
    const roster = new Set((game.attendees || []).map((r) => r.id));

    for (const t of TARGETS) {
        const snap = await db.collection('users').doc(t.uid).get();
        if (!snap.exists) throw new Error(`User ${t.uid} not found`);
        const d = snap.data();
        const cards = (d.discipline && d.discipline.cards) || 0;
        console.log(
            `[TARGET] ${d.display_name} (${t.uid}) | onRoster=${roster.has(t.uid)} | banned=${!!d.banned} | cards=${cards}`,
        );
        if (!roster.has(t.uid)) throw new Error(`${t.uid} is not an attendee of ${GAME_ID}`);
        if (d.banned === true) console.log('   already banned — issueCard will not re-ban');

        if (!WRITE) {
            console.log(`   DRY: would issue RED (forceRed), reason=${REASON}, source=moderator`);
            continue;
        }

        const res = await issueCard({
            userId: t.uid,
            source: SOURCE_MODERATOR,
            reason: REASON,
            gameRef: fnDb.collection('games').doc(GAME_ID),
            gameId: GAME_ID,
            sport: game.sport || 'soccer',
            issuedBy: ISSUED_BY,
            forceRed: true,
            reportRef: null,
            logPrefix: `[card:${t.uid}]`,
        });
        console.log(`   RESULT ok=${res.ok} count=${res.count} isRed=${res.isRed} alreadyBanned=${res.alreadyBanned}`);
    }

    if (!WRITE) {
        console.log('\n[DRY] would post team message:');
        console.log('   ' + TEAM_MESSAGE.text);
        console.log('\n[DRY] no writes performed.');
        return;
    }

    // Posted like every other Poteau team message: the TYPE is what renders it
    // under the Poteau name and mark. There is no Poteau user account, so
    // author_id stays null, and game.messages is never touched.
    const msgRef = await db.collection('messages').add({
        game_id: gameRef,
        type: 'poteau_team_message',
        created: admin.firestore.FieldValue.serverTimestamp(),
        author_id: null,
        author_name: '',
        author_picture: '',
        ...TEAM_MESSAGE,
    });
    console.log(`[MESSAGE] posted ${msgRef.id}`);
    console.log('[DONE]');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[FATAL]', err);
        process.exit(1);
    });
