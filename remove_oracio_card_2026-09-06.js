#!/usr/bin/env node
/**
 * One-off: remove Oracio's yellow card at Stade de la Poterne (6 Sep 2026),
 * as a stated exception, and post the explanation in the game chat.
 *
 * WHAT ACTUALLY HAPPENED. Oracio joined at 11:15 and left at 11:16 (Paris) for
 * a 12:00 kickoff. The late-unapply rule fired correctly: it measures the gap
 * to kickoff, and 44 minutes is inside the window. He then told the chat why
 * ("je viens de me rendre compte que j'ai une heure de route").
 *
 * So the card is NOT a bug, and this is not the Nash case, where the player had
 * been added by mistake and never chose to be in the game. Here Oracio signed
 * up himself and undid it 70 seconds later. The rule did its job.
 *
 * We remove it anyway, ONCE, because the spot was returned to the pool 44
 * minutes before kickoff and the game still filled (16/16 at kickoff, status
 * played). Nobody was left short. That is a judgement call, not a rule, which
 * is why the reply says plainly that it will not happen again: the fix on his
 * side is to check the travel time BEFORE signing up.
 *
 * Note his discipline history already carries a `last_removed_by` from Slack,
 * so this is not the first goodwill gesture. The reply is warm but does not
 * pretend otherwise.
 *
 * Uses the same removal shape as shared/cards.js removeCard(): decrement the
 * counter, clear any ban, and mark the card removed rather than deleting it, so
 * the history stays auditable.
 *
 * Usage:
 *   node remove_oracio_card_2026-09-06.js --dry   # show everything, write nothing
 *   node remove_oracio_card_2026-09-06.js         # do it
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

const DRY = process.argv.includes('--dry');

const ORACIO_UID = '63zMo6szspNOjYjIiRqLv8fHhA43';
const GAME_ID = 'PAABlkY4iUCvpePc7nzo';        // Stade de la Poterne, 6 Sep 12:00
const CARD_ID = 'd1buuULFpMiJYFEBksSQ';

// There is no "Poteau team" user account: `type: 'poteau_team_message'` is what
// makes the client render the row as Poteau. `author_id` is just the sender,
// and the client never shows it for this type. That is Tim here.
const SENDER_UID = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2';

/**
 * The chat message.
 *
 * Broadcast register: the whole game reads this one, so "on", not "je".
 * It states the removal, says once that it is an exception, and gives the
 * actionable bit (check the travel time before joining) without lecturing.
 * No apology for the card, because the card was correct.
 */
const TEXT_FR = "🟨 Carton retiré pour Oracio ⚔️. Il a prévenu tout de suite dans le chat et la place est repartie à temps, donc on fait une exception. Une seule : à partir de maintenant, le carton reste. Le bon réflexe, c'est de vérifier le trajet avant de s'inscrire, pas après.";
const TEXT_EN = "🟨 Card removed for Oracio ⚔️. He told the chat straight away and the spot went back in time, so we're making an exception. Just this once: from now on the card stays. The right habit is to check the travel time before joining, not after.";
const TEXT_ES = "🟨 Tarjeta retirada para Oracio ⚔️. Avisó enseguida en el chat y la plaza volvió a tiempo, así que hacemos una excepción. Solo esta vez: a partir de ahora la tarjeta se queda. Lo suyo es comprobar el trayecto antes de apuntarse, no después.";
const TEXT_IT = "🟨 Cartellino rimosso per Oracio ⚔️. Ha avvisato subito in chat e il posto è tornato libero in tempo, quindi facciamo un'eccezione. Solo questa volta: da adesso il cartellino resta. La cosa giusta è controllare il tragitto prima di iscriversi, non dopo.";

(async () => {
    const userRef = db.collection('users').doc(ORACIO_UID);
    const gameRef = db.collection('games').doc(GAME_ID);
    const cardRef = userRef.collection('discipline_cards').doc(CARD_ID);

    // Verify the world still looks the way the plan assumes.
    const [user, card, game] = await Promise.all([userRef.get(), cardRef.get(), gameRef.get()]);
    if (!user.exists) throw new Error('Oracio user doc is gone');
    if (!card.exists) throw new Error('the card doc is gone');
    if (!game.exists) throw new Error('the game doc is gone');

    const c = card.data();
    const u = user.data();
    const g = game.data();
    console.log('user        :', u.display_name, '| banned:', u.banned === true);
    console.log('discipline  :', JSON.stringify(u.discipline || null));
    console.log('card        :', c.colour, c.source, '| issued', c.issued_at.toDate().toISOString());
    console.log('removed_at  :', c.removed_at ? c.removed_at.toDate().toISOString() : 'null (still standing)');
    console.log('game        :', g.centre, g.date.toDate().toISOString(), '| status', g.status, '|', (g.attendees || []).length + '/' + g.max_players);

    if (c.removed_at) {
        console.log('\nAlready removed. Nothing to do, and NOT posting a second message.');
        process.exit(0);
    }

    if (DRY) {
        console.log('\n--- would remove the card and post ---\n');
        console.log('FR:', TEXT_FR, '\n');
        console.log('EN:', TEXT_EN, '\n');
        console.log('ES:', TEXT_ES, '\n');
        console.log('IT:', TEXT_IT);
        console.log('\nDry run: nothing written.');
        process.exit(0);
    }

    // 1. Remove the card.
    const before = (u.discipline && u.discipline.cards) || 0;
    const update = {
        banned: false,
        'discipline.last_removed_at': admin.firestore.FieldValue.serverTimestamp(),
        'discipline.last_removed_by': 'timothe',
    };
    if (before > 0) update['discipline.cards'] = admin.firestore.FieldValue.increment(-1);
    await userRef.update(update);
    await cardRef.update({
        removed_at: admin.firestore.FieldValue.serverTimestamp(),
        removed_by: 'timothe',
    });
    console.log(`\ncard removed (discipline.cards ${before} -> ${Math.max(0, before - 1)})`);

    // 2. Post the explanation into the game chat.
    const msg = await db.collection('messages').add({
        type: 'poteau_team_message',
        trigger: 'card_removed_manual',
        game_id: gameRef,
        author_id: db.collection('users').doc(SENDER_UID),
        user: userRef,                       // who the message is about
        author_picture: '',
        text: TEXT_FR,
        text_en: TEXT_EN,
        text_es: TEXT_ES,
        text_it: TEXT_IT,
        created: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('message posted:', msg.id);

    // Deliberately NOT touching game.messages: the chat reads by querying
    // messages.game_id, like every other message in the collection.
    process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
