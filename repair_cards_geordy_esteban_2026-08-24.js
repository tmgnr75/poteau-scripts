/**
 * Poteau | Repair for card_geordy_esteban_2026-08-24.js
 *
 * The original run banned both players and incremented the counter, but its
 * three ref-carrying writes were rejected: the gameRef was built from the
 * scripts-side firebase-admin while cards.js runs on the functions-side copy,
 * and Firestore refuses a DocumentReference from a different instance.
 * cards.js swallows those errors by design, so the run reported ok=true.
 *
 * Missing per player: the discipline_cards history doc, the card_issued push,
 * and the per-card chat message.
 *
 * This does NOT re-run issueCard -- that would increment the counter to 2 and
 * re-ban. It performs only the three failed writes, with the same values
 * issueCard would have used (red, moderator, harassment_abuse, card_number 1,
 * direct_red true since forceRed landed on the first card).
 *
 * Idempotent: skips a player who already has a discipline_cards doc.
 *
 * Usage:
 *   node repair_cards_geordy_esteban_2026-08-24.js --dry
 *   node repair_cards_geordy_esteban_2026-08-24.js --write
 */
const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const FUNCTIONS = path.join(__dirname, '..', 'cloud-functions', 'functions');
// Run entirely on the FUNCTIONS-side admin: every ref below is passed into
// functions-side code, so they must all come from this one instance.
const admin = require(path.join(FUNCTIONS, 'node_modules', 'firebase-admin'));
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'krank-club',
    });
}
const db = admin.firestore();

const { writeCardHistory, cardPushTexts, SOURCE_MODERATOR } = require(
    path.join(FUNCTIONS, 'shared', 'cards.js'),
);

const GAME_ID = 'NSVNXEDR9TelJPw9o438';
const REASON = 'harassment_abuse';
const ISSUED_BY = 'tim';
const WRITE = process.argv.includes('--write');

const TARGETS = [
    { uid: '8bUFe1hkmuRyNeJWeJoBbiDUSKG3' },
    { uid: 'BQASlhA8TcbkPCGSc3Fyypo23VG2' },
];

// Copied verbatim from moderatorCardTexts() in shared/cards.js (not exported).
// Red branch, reason harassment_abuse.
function redCardTexts(name, gender) {
    const who = name || 'Ce joueur';
    return {
        text: `🟥 Carton rouge pour ${who} suite à des propos déplacés. Son accès à l'app est maintenant bloqué.`,
        text_en: `🟥 Red card for ${who} following inappropriate behaviour. Their access to the app is now blocked.`,
        text_es: `🟥 Tarjeta roja para ${who} tras un comportamiento inapropiado. Su acceso a la app está ahora bloqueado.`,
        text_it: `🟥 Cartellino rosso per ${who} a seguito di un comportamento inappropriato. Il suo accesso all'app è ora bloccato.`,
    };
}

async function main() {
    console.log(`[START] mode=${WRITE ? 'WRITE' : 'DRY'}`);
    const gameRef = db.collection('games').doc(GAME_ID);
    const gameSnap = await gameRef.get();
    const game = gameSnap.data();
    const sport = game.sport || 'soccer';

    for (const t of TARGETS) {
        const userRef = db.collection('users').doc(t.uid);
        const snap = await userRef.get();
        const d = snap.data();
        const name = d.display_name || d.first_name || null;
        const cards = (d.discipline && d.discipline.cards) || 0;
        const logPrefix = `[repair:${t.uid}]`;

        const existing = await userRef.collection('discipline_cards').get();
        console.log(`\n[TARGET] ${name} | banned=${!!d.banned} | cards=${cards} | history=${existing.size}`);

        if (existing.size > 0) {
            console.log('   already has history — skipping (idempotent)');
            continue;
        }
        if (!WRITE) {
            console.log('   DRY: would write history doc, push, and chat message');
            console.log('   chat: ' + redCardTexts(name, d.gender).text);
            continue;
        }

        await writeCardHistory({
            db,
            userRef,
            colour: 'red',
            source: SOURCE_MODERATOR,
            reason: REASON,
            gameRef,
            sport,
            directRed: true,
            cardNumber: cards,
            issuedBy: ISSUED_BY,
            reportRef: null,
            logPrefix,
        });

        // Same shape as pushCardToUser() in shared/cards.js (not exported).
        await db.collection('connect').add({
            type: 'card_issued',
            recipient: [userRef],
            user: userRef,
            game: gameRef,
            source: `card_${SOURCE_MODERATOR}`,
            status: 'published',
            datetime: admin.firestore.FieldValue.serverTimestamp(),
            destination: `https://poteau.app/game/${GAME_ID}`,
            picture: '',
            hash_pic: '',
            sport,
            ...cardPushTexts(true, SOURCE_MODERATOR, cards),
        });
        console.log(`${logPrefix} Card push queued`);

        // Same shape as postCardToGameChat() in shared/cards.js (not exported).
        await db.collection('messages').add({
            game_id: gameRef,
            trigger: 'late_unapply_red_card',
            type: 'poteau_team_message',
            author_id: userRef,
            author_name: name || '',
            author_picture: '',
            created: admin.firestore.FieldValue.serverTimestamp(),
            user: userRef,
            ...redCardTexts(name, d.gender),
        });
        console.log(`${logPrefix} Card message posted to game chat`);
    }
    console.log('\n[DONE]');
}

main().then(() => process.exit(0)).catch((e) => { console.error('[FATAL]', e); process.exit(1); });
