#!/usr/bin/env node
/**
 * One-off moderation: warn Admez (Adlane Mezouar) for advertising a fuel-resale
 * service in game chats, and delete the ads. NO CARD, NO BAN.
 *
 * WHAT HE DID, MEASURED
 *
 *   33 near-identical commercial messages into 33 distinct game chats, in
 *   three escalating waves:
 *       27 Aug 2026   7 chats
 *       14 Sep 2026  11 chats
 *       15 Sep 2026  15 chats   <- the wave that got reported
 *   Every one offers to buy people petrol (SP95/SP98) below pump price on a
 *   company card, with his phone number. Nobody has ever replied to one.
 *
 * WHY THIS IS A WARNING AND NOT A CARD
 *
 * The test from feedback_never_auto_ban_alert_instead is "operator or real
 * player?", and the history answers it plainly:
 *
 *   account age        1,009 days (Dec 2023)
 *   games PLAYED       28 (42 with him in attendees)
 *   positive reports   29
 *   no-show / late     0 / 0
 *   discipline cards   0
 *   messages written   708, continuous across 21 of the last 24 months
 *   games organized    0
 *   upcoming games     0  (a ban would kill nothing, but that cuts both ways)
 *
 * An operator has ten near-identical pitches over two days and nothing else.
 * He has two and a half years of ordinary football talk -- "Tout le monde a
 * confirmé ?", "Prend mohamed mon train est supp ptn" -- and 29 positive
 * reports. A red card is a ban, and the card ladder exists for people who wreck
 * games (no-shows, late unapplies); he has never done either.
 *
 * But he is escalating, 7 -> 11 -> 15, so silence is not an option either. One
 * clear warning is proportionate, and if he ignores it the next card is a
 * normal card on a clean record rather than a ban out of nowhere.
 *
 * WHY THE PUSH SAYS "ON A VU" AND NOT "DES JOUEURS ONT SIGNALÉ"
 *
 * Nobody reported him. Checked: of the 33 chats, 19 have later messages and all
 * of them are unrelated football talk. Telling him players complained would be
 * a false factual claim about real users, and it is the one line he might act
 * on -- he plays weekly with the same faces at Foot POWER 5 and IMPULSTAR, and
 * would go looking for who. "On a vu" is true, needs no source, and is the
 * stronger message anyway: the platform is watching, rather than one teammate
 * turned him in.
 *
 * WHY A BACKUP-SEND CONNECT DOC
 *
 * `runTranslateAndSendPush` (index.js ~6740) overwrites title/message from the
 * `translations` table whenever it recognises the `type`. An UNRECOGNISED type
 * takes the [BACKUP SEND] branch instead, which publishes the doc's own
 * title/message fields verbatim. So the type here is deliberately absent from
 * that table, and all four languages are written explicitly.
 *
 * `sender` is deliberately UNSET: translateAndSendPush filters the sender out
 * of the recipient list, so a self-directed push with sender == recipient is
 * silently dropped as "No recipients to process" (see pushUnbanToUser).
 *
 * `destination` must not contain the substring "game" -- that is what makes the
 * translator try to fetch a game and derive a date and centre, and this push
 * has neither.
 *
 * BOTH ACCOUNTS. +33659732280 carries a second, dormant account
 * (lqUYej5XLfVF5w9Pl0ntUM2lWG23, 0 games, 15 messages, last active Dec 2024).
 * It gets the same push so the warning cannot be sidestepped by switching.
 *
 * Usage:
 *   node warn_admez_promo_2026-09-16.js --dry    # show everything, write nothing
 *   node warn_admez_promo_2026-09-16.js --write  # do it
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

const DRY = !process.argv.includes('--write');

const MAIN_UID = 'QUcoS7jPlBhG90puaBihuYFly2k1';       // Admez, the active account
const SECOND_UID = 'lqUYej5XLfVF5w9Pl0ntUM2lWG23';     // same phone, dormant

/**
 * The warning.
 *
 * Push length, not letter length. Four sentences: what we saw, the rule, no
 * card this time and why, what happens next time. No "je" -- this is Poteau
 * speaking, not whoever ran the script. Accents throughout, no em dashes.
 *
 * It does not name a venue or a date. He posted in 33 chats and knows exactly
 * which messages these are; listing them would only make it read like a case
 * file, and the tone we want is a word from the team, not a summons.
 */
const COPY = {
    fr: {
        title: 'Tes messages dans les chats',
        message: "Salut Adlane, on a vu tes pubs pour l'essence dans plusieurs chats. La promo n'est pas autorisée sur Poteau. Pas de carton cette fois vu ton parcours, mais le prochain signalement en déclenchera un.",
    },
    en: {
        title: 'Your messages in the chats',
        message: "Hi Adlane, we saw your petrol ads in several game chats. Promoting a service isn't allowed on Poteau. No card this time given your record, but the next report will trigger one.",
    },
    es: {
        title: 'Tus mensajes en los chats',
        message: 'Hola Adlane, hemos visto tus anuncios de gasolina en varios chats. La promoción no está permitida en Poteau. Sin tarjeta esta vez por tu historial, pero el próximo aviso activará una.',
    },
    it: {
        title: 'I tuoi messaggi nelle chat',
        message: 'Ciao Adlane, abbiamo visto le tue pubblicità di benzina in diverse chat. La promozione non è consentita su Poteau. Nessun cartellino stavolta visto il tuo percorso, ma la prossima segnalazione ne farà scattare uno.',
    },
};

/** Matches the fuel pitch across all three waves. Same test used to count them. */
function isFuelAd(text) {
    const t = (text || '').toLowerCase();
    return t.includes('sp95') || t.includes('sp98') ||
        (t.includes('essence') && t.includes('moins cher'));
}

async function findAds(uid) {
    const ref = db.collection('users').doc(uid);
    const snap = await db.collection('messages').where('author_id', '==', ref).get();
    return snap.docs
        .filter((d) => isFuelAd(d.data().text))
        .sort((a, b) => (a.data().created?.toMillis?.() || 0) - (b.data().created?.toMillis?.() || 0));
}

async function pushWarning(uid) {
    const userRef = db.collection('users').doc(uid);
    const doc = {
        // Deliberately NOT in the `translations` table, so the send takes the
        // [BACKUP SEND] branch and uses the fields below verbatim.
        type: 'promo_warning',
        // NO `sender` -- see the header note.
        recipient: [userRef],
        user: userRef,
        game: null,
        source: 'moderation_warning',
        status: 'published',
        datetime: admin.firestore.FieldValue.serverTimestamp(),
        // No "game" substring: it would make the translator hunt for a game.
        destination: 'https://poteau.app',
        picture: '',
        hash_pic: '',
        sport: 'soccer',
        title: COPY.fr.title,
        message: COPY.fr.message,
        title_en: COPY.en.title,
        message_en: COPY.en.message,
        title_es: COPY.es.title,
        message_es: COPY.es.message,
        title_it: COPY.it.title,
        message_it: COPY.it.message,
    };

    if (DRY) {
        console.log(`  [DRY] would create connect doc for ${uid}`);
        return null;
    }
    const written = await db.collection('connect').add(doc);
    console.log(`  connect/${written.id} created for ${uid}`);
    return written.id;
}

async function main() {
    console.log(`=== Admez promo warning ===  ${DRY ? 'DRY RUN (no writes)' : 'WRITING'}\n`);

    // --- 1. Confirm both accounts, and that neither is banned/carded ---------
    console.log('--- accounts ---');
    for (const uid of [MAIN_UID, SECOND_UID]) {
        const s = await db.collection('users').doc(uid).get();
        if (!s.exists) { console.log(`  ${uid}: NOT FOUND -- aborting`); process.exit(1); }
        const d = s.data();
        const cards = await db.collection('users').doc(uid).collection('discipline_cards').get();
        console.log(`  ${uid}  ${d.display_name}  banned:${d.banned ?? 'unset'}  cards:${cards.size}  auth_push:${d.auth_push ?? 'unset'}  lang:${d.language ?? 'unset'}`);
    }

    // --- 2. The ads ---------------------------------------------------------
    console.log('\n--- fuel ads to delete ---');
    const ads = { [MAIN_UID]: await findAds(MAIN_UID), [SECOND_UID]: await findAds(SECOND_UID) };
    let total = 0;
    for (const [uid, docs] of Object.entries(ads)) {
        console.log(`  ${uid}: ${docs.length}`);
        const byDay = {};
        for (const d of docs) {
            const day = d.data().created?.toDate?.().toISOString().slice(0, 10) || '?';
            byDay[day] = (byDay[day] || 0) + 1;
        }
        for (const [day, n] of Object.entries(byDay)) console.log(`      ${day}: ${n}`);
        total += docs.length;
    }
    console.log(`  TOTAL: ${total}`);

    if (ads[MAIN_UID].length) {
        console.log('\n  sample (first ad, full text):');
        console.log('  ' + JSON.stringify(ads[MAIN_UID][0].data().text));
    }

    // --- 3. The push --------------------------------------------------------
    console.log('\n--- push copy (FR) ---');
    console.log(`  title  : ${COPY.fr.title}`);
    console.log(`  message: ${COPY.fr.message}`);

    console.log('\n--- creating connect docs ---');
    for (const uid of [MAIN_UID, SECOND_UID]) await pushWarning(uid);

    // --- 4. Delete the ads --------------------------------------------------
    console.log('\n--- deleting ads ---');
    if (DRY) {
        console.log(`  [DRY] would delete ${total} message docs`);
    } else {
        let done = 0;
        for (const docs of Object.values(ads)) {
            // Chunked: a batch caps at 500, and this is well under, but keep the
            // shape so it stays correct if the count ever grows.
            for (let i = 0; i < docs.length; i += 400) {
                const batch = db.batch();
                for (const d of docs.slice(i, i + 400)) batch.delete(d.ref);
                await batch.commit();
                done += docs.slice(i, i + 400).length;
            }
        }
        console.log(`  deleted ${done} message docs`);
    }

    console.log(`\n=== done ===  ${DRY ? 'nothing was written. Re-run with --write' : 'warning sent, ads removed'}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1); });
