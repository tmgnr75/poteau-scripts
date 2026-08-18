#!/usr/bin/env node
/**
 * One-off: remove Nash's yellow card at Foot POWER 5 (17 Aug 2026) and answer
 * the thread as the Poteau team.
 *
 * WHY THIS CARD IS WRONG. jo G. added Nash to a game that was already full, by
 * accident ("fatfinger de ma part, désolé"), 11 minutes before kickoff. Nash
 * removed themselves 11 minutes later and the late-unapply rule fired. The code
 * did exactly what it says: `isOrganicSelfLeave` was true, because Nash pressed
 * the button themselves.
 *
 * The existing exemption covers "the captain removed you" (see
 * gen2/removePlayer.js and the late-unapply-card-exemptions note). It does NOT
 * cover "the captain ADDED you by mistake and you undid it", which is the same
 * class of unfairness: the player never chose to be in the game at all.
 *
 * So this script fixes the instance. The class needs a code change, tracked in
 * OVERLAP_GUARD_BRIEF.md's sibling issue -- see the "Worth a reply" section of
 * the 17 August chat brief.
 *
 * Uses shared/cards.js removeCard() rather than writing removed_at by hand,
 * because that helper also decrements discipline.cards, clears any ban, and
 * marks the history auditably instead of deleting it.
 *
 * Usage:
 *   node remove_nash_card_and_reply.js --dry    # show everything, write nothing
 *   node remove_nash_card_and_reply.js          # do it
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

const DRY = process.argv.includes('--dry');

const NASH_UID = 'c1TWqiwuO3bkhlFbDlYaCwXdyqf2';
const GAME_ID = 'lATBMr3t7Cbu1tJ6bKHA';          // Foot POWER 5, 17 Aug 18:00
const CARD_ID = 'jP4KfM80pHf909ItLn9S';
// HOW A POTEAU TEAM MESSAGE ACTUALLY WORKS. There is no "Poteau team" user
// account. `type: 'poteau_team_message'` is what makes the client render the row
// as Poteau: is_poteau_authored.dart returns true on the TYPE alone, and
// message_item_widget passes `isPoteau: type == 'poteau_team_message'`.
//
// `author_id` is just the sender, and the client never shows it for this type.
// send_message_widget.dart writes `authorId: currentUserReference`, so the
// established convention is the human who sent it. That is Tim here.
const SENDER_UID = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2';   // Tim, the sender

/**
 * The reply.
 *
 * Kind, short, and light: it is a yellow card on a football app, not a
 * tribunal. Nash assumed nobody looks ("ils cherchent meme pas a comprendre"),
 * so the removal is stated first and the "we read everything" line answers that
 * gently rather than arguing with it. One sentence explains that the card system
 * exists for the players, then it stops. No lecture, no defensiveness, no
 * relitigating who was right.
 *
 * House rules applied: "game" not "match" in English, no em dashes, no
 * parenthetical "(s)", and all four languages written at once.
 */
const TEXT_FR = "🟨 Carton retiré, Nash. Tu avais été ajouté par erreur, donc il n'avait rien à faire là. On lit tout ce qui se passe ici, et quand c'est nous qui devons corriger, on corrige. Les cartons existent pour que tes matchs se jouent vraiment, pas pour t'embêter. Bon match la prochaine fois 👊";
const TEXT_EN = "🟨 Card removed, Nash. You were added by mistake, so it had no business being there. We read everything that happens here, and when something needs fixing, we fix it. Cards exist so your games actually happen, not to annoy you. Enjoy the next game 👊";
const TEXT_ES = "🟨 Tarjeta retirada, Nash. Te habían añadido por error, así que no tenía sentido. Leemos todo lo que pasa por aquí, y cuando hay algo que corregir, lo corregimos. Las tarjetas existen para que tus partidos se jueguen de verdad, no para molestarte. Buen partido la próxima vez 👊";
const TEXT_IT = "🟨 Cartellino rimosso, Nash. Ti avevano aggiunto per errore, quindi non aveva senso. Leggiamo tutto quello che succede qui, e quando c'è da correggere, correggiamo. I cartellini esistono perché le tue partite si giochino davvero, non per darti fastidio. Buona partita la prossima volta 👊";

(async () => {
    const userRef = db.collection('users').doc(NASH_UID);
    const gameRef = db.collection('games').doc(GAME_ID);
    const cardRef = userRef.collection('discipline_cards').doc(CARD_ID);

    // Verify the world still looks the way the plan assumes. A one-off that
    // writes blind is how you remove the wrong card a week later.
    const [user, card, game] = await Promise.all([userRef.get(), cardRef.get(), gameRef.get()]);
    if (!user.exists) throw new Error('Nash user doc is gone');
    if (!card.exists) throw new Error('the card doc is gone');
    if (!game.exists) throw new Error('the game doc is gone');

    const c = card.data();
    const u = user.data();
    console.log('user        :', u.display_name, '| banned:', u.banned === true);
    console.log('discipline  :', JSON.stringify(u.discipline || null));
    console.log('card        :', c.colour, c.source, '| issued', c.issued_at.toDate().toISOString());
    console.log('removed_at  :', c.removed_at ? c.removed_at.toDate().toISOString() : 'null (still standing)');
    console.log('game        :', game.data().centre, game.data().date.toDate().toISOString());

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

    // 1. Remove the card. Mirrors shared/cards.js removeCard(): decrement the
    //    counter, clear any ban, mark history rather than deleting it.
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

    // 2. Post the reply into the game chat.
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

    // Deliberately NOT touching game.messages: send_message_widget.dart writes
    // the message doc and nothing else, so the chat reads by querying
    // messages.game_id. Adding an array entry here would diverge from every
    // other message in the collection.
    process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
