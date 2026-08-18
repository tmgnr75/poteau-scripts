#!/usr/bin/env node
/**
 * Correct the Poteau team message sent to Nash, and the `connect` notification
 * that carried it.
 *
 * WHAT THE FIRST VERSION GOT WRONG. It said Nash "had been added by mistake".
 * The chat log says otherwise:
 *
 *   15:11  jo G. a ajouté 3 amis.        <- organizer takes 3 spots
 *   15:12  Nash a rejoint le match.      <- Nash joins normally
 *   15:18  jo G.: "c'est déjà complet (fatfinger de ma part, désolé)"
 *   15:29  Nash a quitté le match.       <- squeezed out, leaves
 *   15:29  yellow card issued
 *
 * So nobody added Nash. Nash joined a game that the organizer had not reserved
 * enough spots in, found there was no room, and stepped aside. That is a human
 * mistake by the organizer, not a bug, and the copy must not imply either that
 * Nash was added by someone or that the app malfunctioned.
 *
 * Two documents carry the text and BOTH need it, or the push notification and
 * the chat disagree:
 *   messages/GbKPSVwhDtcFd3tEUEyb        the chat row
 *   connect/m9opvuFFnoNIA0SAZqA8         the notification sent to 5 people
 *
 * The connect doc also had the FRENCH text in message_en/es/it, which is a bug
 * in how it was created. Fixed here too.
 *
 * Usage:
 *   node fix_nash_message_text.js --dry
 *   node fix_nash_message_text.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const DRY = process.argv.includes('--dry');
const MSG_ID = 'GbKPSVwhDtcFd3tEUEyb';
const CONNECT_ID = 'm9opvuFFnoNIA0SAZqA8';

// Kind, short, light. It no longer explains the cause wrongly: it just says the
// card should not have landed on Nash, because leaving a game you could not fit
// into is not a late drop out. No blame pointed at the organizer either, since
// this is public and they already apologised twice in the thread.
const FR = "🟨 Carton retiré, Nash. Il n'y avait plus de place pour toi, et laisser la place dans ce cas, ce n'est pas une désinscription de dernière minute. On lit tout ce qui se passe ici, et quand il y a quelque chose à corriger, on corrige. Bon match la prochaine fois 👊";
const EN = "🟨 Card removed, Nash. There was no room left for you, and stepping aside in that situation is not a last minute drop out. We read everything that happens here, and when something needs fixing, we fix it. Enjoy the next game 👊";
const ES = "🟨 Tarjeta retirada, Nash. Ya no quedaba sitio para ti, y dejar la plaza en ese caso no es una baja de última hora. Leemos todo lo que pasa por aquí, y cuando hay algo que corregir, lo corregimos. Buen partido la próxima vez 👊";
const IT = "🟨 Cartellino rimosso, Nash. Non c'era più posto per te, e lasciare il posto in quel caso non è una disdetta dell'ultimo minuto. Leggiamo tutto quello che succede qui, e quando c'è da correggere, correggiamo. Buona partita la prossima volta 👊";

(async () => {
    const msgRef = db.doc('messages/' + MSG_ID);
    const conRef = db.doc('connect/' + CONNECT_ID);
    const [m, c] = await Promise.all([msgRef.get(), conRef.get()]);
    if (!m.exists) throw new Error('message doc is gone');
    if (!c.exists) throw new Error('connect doc is gone');

    console.log('current message text :', m.data().text.slice(0, 80), '...');
    console.log('current connect text :', c.data().message.slice(0, 80), '...');
    console.log('connect recipients   :', (c.data().recipient || []).length);

    if (DRY) {
        console.log('\n--- would write ---');
        console.log('FR:', FR, '\n');
        console.log('EN:', EN, '\n');
        console.log('ES:', ES, '\n');
        console.log('IT:', IT);
        console.log('\nDry run: nothing written.');
        process.exit(0);
    }

    // The chat row. Field names here are text / text_en / text_es / text_it.
    await msgRef.update({ text: FR, text_en: EN, text_es: ES, text_it: IT });
    console.log('\nmessage updated');

    // The notification. Different field names (message / message_en / ...), and
    // the localised ones were wrongly holding French.
    await conRef.update({ message: FR, message_en: EN, message_es: ES, message_it: IT });
    console.log('connect updated');
    process.exit(0);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
