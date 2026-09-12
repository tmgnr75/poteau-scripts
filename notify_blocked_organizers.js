#!/usr/bin/env node
// One-off: reach the organizers left with nothing by the publish-price guard.
//
// WHO AND WHY. `baa7107` (10 Sep 2026) made publishGame refuse a draft with no
// price, which is right -- every surface renders a missing price as "Gratuit",
// and 170 games had already shipped that way since 1 August. But on 5.1.0 the
// refusal branch was a bare `return`, so the Publish button does nothing at all
// and says nothing. Eleven organizers hit that; one pressed Publish 34 times
// across 8 drafts. Five of the eleven have published NOTHING since.
//
// Their drafts cannot be rescued server-side. 21 of the 24 carry no price
// anywhere, `price_last_known` included, and inference deliberately refuses
// their slots: Aubervilliers Friday 20h is 14 EUR most weeks with real
// discounted games at 5 / 9 / 10 / 11.75 mixed in, so no rule can tell "the
// price is 14" from "5 happens here too" without charging someone's players a
// number nobody typed. Backtested 2026-09-12 over 32,429 games: every widening
// tried, and a dominant-mode rule, came out measurably worse than the live one.
// So the only honest fix for these people is to tell them.
//
// AUTH_EMAIL IS HONOURED. Two of the five unsubscribed. They are skipped, not
// mailed "just this once" -- the opt-out exists to be obeyed, and this is a
// convenience message, not a transactional one.
//
// Usage:
//   source ~/.poteau/aws_ses.env
//   node notify_blocked_organizers.js            # dry run, prints and sends nothing
//   node notify_blocked_organizers.js --send     # actually sends
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
}
const db = admin.firestore();

const { SESClient, SendTemplatedEmailCommand } = require(
    '/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/@aws-sdk/client-ses');

const SEND = process.argv.includes('--send');

// The eleven blocked 11-12 Sep. Only those who published nothing since are
// mailed; the other six got a game out and do not need a message about it.
const TARGETS = [
    'kTnlLuq5sVP4ruGk3nS3WinUk7l1', // Lamine, 8 drafts, 34 attempts
    'r5isbrwYwsZGMzDE05K3XiXUlCg1', // Boulala Nadjib
    'NqAv47MWDfc73NDEAhwEoirV0zA2', // Ousmane
    '5knHAtmIZYhLrjgyf7uMU03MvTs2', // Kader Fertikh, 3 drafts
    'QQTKXAUQZMRLobjK9Vr9jd7Nzp02', // Othmane
];

// Poteau voice: "tu", speaks as "on", never "je", no em dashes, signed
// L'equipe Poteau. It does not apologise for the product and does not claim
// anything was broken, but it does not pretend either -- it says what happened
// and what to do, because these people tried and got nothing.
const COPY = {
    fr: {
        heading: 'Ton match n\'est pas parti',
        body: [
            'Tu as essayé de publier un match ces derniers jours et il n\'est jamais apparu. Le prix manquait sur le brouillon, et depuis le 10 septembre on ne publie plus un match sans prix, parce qu\'il s\'affichait comme gratuit et que les joueurs arrivaient sans savoir quoi payer.',
            'Sur ta version de l\'app, le bouton ne te disait rien du tout. Normal que tu aies insisté.',
            'Ton brouillon est toujours là. Rouvre-le, remets le prix, et il partira cette fois. La prochaine mise à jour affiche directement ce qui manque.',
        ].join('\n\n'),
        cta: 'Reprendre mon brouillon',
        footer: 'Tu reçois ce message parce que tu as essayé de créer un match sur Poteau.',
        unsub: 'Se désabonner',
    },
    en: {
        heading: 'Your game never went out',
        body: [
            'You tried to publish a game in the last few days and it never showed up. The price was missing from the draft, and since 10 September a game without a price is no longer published, because it showed up as free and players arrived not knowing what to pay.',
            'On your version of the app, the button told you nothing at all. No wonder you kept pressing it.',
            'Your draft is still there. Reopen it, put the price back, and it will go out this time. The next update says straight away what is missing.',
        ].join('\n\n'),
        cta: 'Open my draft',
        footer: 'You are receiving this because you tried to create a game on Poteau.',
        unsub: 'Unsubscribe',
    },
};

(async () => {
    const ses = new SESClient({
        region: 'eu-north-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
    if (SEND && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)) {
        console.error('Missing AWS creds. Run: source ~/.poteau/aws_ses.env');
        process.exit(1);
    }

    console.log(SEND ? '=== SENDING ===' : '=== DRY RUN (no email sent) ===');
    let sent = 0, skipped = 0;

    for (const uid of TARGETS) {
        const doc = await db.collection('users').doc(uid).get();
        if (!doc.exists) { console.log(`SKIP ${uid} no user doc`); skipped++; continue; }
        const u = doc.data();
        const name = u.display_name || '?';

        if (u.auth_email === false) {
            console.log(`SKIP ${name} unsubscribed (auth_email=false)`);
            skipped++; continue;
        }
        if (!u.email) { console.log(`SKIP ${name} no email`); skipped++; continue; }
        if (u.banned === true) { console.log(`SKIP ${name} banned`); skipped++; continue; }

        const lang = (u.language === 'fr' || !u.language) ? 'fr' : (COPY[u.language] ? u.language : 'en');
        const c = COPY[lang] || COPY.fr;

        const params = {
            Destination: { ToAddresses: [u.email] },
            Source: 'Poteau <no-reply@mail.poteau.app>',
            Template: 'GenericEmail',
            TemplateData: JSON.stringify({
                recipientId: uid,
                connectId: 'publish-price-2026-09-12',
                email: u.email,
                auth_email: true,
                language: lang,
                heading_text: c.heading,
                main_body_text: c.body,
                cta_link_text: c.cta,
                cta_link_url: 'https://poteau.app/games?source=email_publish_price',
                footer_text: c.footer,
                unsubscribe_url: `https://poteau-app.com/unsubscribe?uid=${uid}&ml=${encodeURIComponent(u.email)}`,
                unsubscribe_text: c.unsub,
                picture: '',
                title: c.heading,
            }),
            ConfigurationSetName: 'generic-emails',
        };

        if (!SEND) {
            console.log(`\n--- ${name} <${u.email}> [${lang}] ---`);
            console.log(c.heading);
            console.log(c.body);
            console.log(`[${c.cta}]`);
            continue;
        }
        try {
            await ses.send(new SendTemplatedEmailCommand(params));
            console.log(`SENT ${name} <${u.email}> [${lang}]`);
            sent++;
        } catch (e) {
            console.error(`FAIL ${name}: ${e.message}`);
        }
    }
    console.log(`\n${SEND ? `sent ${sent}` : 'dry run'} · skipped ${skipped}`);
    process.exit(0);
})();
