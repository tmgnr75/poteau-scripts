/**
 * Deploy the inactivity-warning email templates to AWS SES.
 *
 * Creates or updates one SES template per language:
 *   InactivityEmail_fr / _en / _es / _it
 *
 * Idempotent: tries Create, falls back to Update if the template already
 * exists, so re-running after a copy fix is safe. Same shape as
 * deployOtcEmails.js, which is the prior art.
 *
 * IMPORTANT: editing the HTML in scripts/templates/inactivity/ changes nothing
 * until this script is re-run. The template lives in SES, not in the repo.
 *
 * Usage:
 *   source ~/.poteau/aws_ses.env && node deployInactivityEmails.js
 *   node deployInactivityEmails.js --dry     # render + validate, send nothing
 *
 * Variables used by the templates:
 *   {{FIRST_NAME}}      the person's first name, or a neutral fallback
 *   {{DELETION_DATE}}   localised date the account goes, e.g. "1er juin 2027"
 *   {{NEW_PLAYERS}}     how many people joined since they left
 *   {{GAMES_PLAYED}}    how many games were played on Poteau since they left
 *   {{CTA_URL}}         deep link back into the app
 *   {{UNSUBSCRIBE_URL}} one-click opt-out
 */

const fs = require('fs');
const path = require('path');
const {
    SESv2Client,
    CreateEmailTemplateCommand,
    UpdateEmailTemplateCommand,
} = require('@aws-sdk/client-sesv2');

const REGION = 'eu-north-1';
const DRY = process.argv.includes('--dry');

// Subject lines live in the SES template, so they are translated here.
// The deletion date is in the subject deliberately: it is the one fact that
// decides whether the email gets opened at all.
const LANGS = {
    fr: {
        subject: 'Ton compte Poteau part le {{DELETION_DATE}}',
        text: [
            'Ça fait un bail, {{FIRST_NAME}}.',
            '',
            "Ton compte Poteau dort depuis un moment. On fait le ménage dans les comptes inactifs, et le tien part le {{DELETION_DATE}} si tu ne repasses pas d'ici là.",
            '',
            "Mais avant que tu t'en ailles : {{NEW_PLAYERS}} nouveaux joueurs ont rejoint Poteau et {{GAMES_PLAYED}} matchs ont été joués depuis ton dernier passage.",
            '',
            "L'app aussi a changé. Elle est plus rapide, on voit enfin le score en direct pendant le match, et trouver une place près de chez toi prend quelques secondes.",
            '',
            "Ton profil, tes stats et ton historique sont encore là. Ouvre l'app une fois et tout repart : {{CTA_URL}}",
            '',
            'Tu ne joues plus ? Ne fais rien, ton compte et tes données partiront tout seuls le {{DELETION_DATE}}.',
            '',
            "On t'écrit parce que la loi nous demande de ne pas garder les données de comptes inactifs indéfiniment. Une question ? Réponds à cet e-mail, on lit tout.",
            '',
            "Ne plus recevoir d'e-mails : {{UNSUBSCRIBE_URL}}",
        ].join('\n'),
    },
    en: {
        subject: 'Your Poteau account goes on {{DELETION_DATE}}',
        text: [
            "It's been a while, {{FIRST_NAME}}.",
            '',
            "Your Poteau account has been asleep for a while. We're clearing out inactive accounts, and yours goes on {{DELETION_DATE}} unless you drop by before then.",
            '',
            'But before you go: {{NEW_PLAYERS}} new players have joined Poteau and {{GAMES_PLAYED}} games have been played since you were last here.',
            '',
            "The app changed too. It's faster, you can finally follow the score live during the game, and finding a spot near you takes seconds.",
            '',
            'Your profile, your stats and your history are all still there. Open the app once and everything picks up where it left off: {{CTA_URL}}',
            '',
            'Not playing anymore? Do nothing, and your account and data will go on their own on {{DELETION_DATE}}.',
            '',
            "We're writing because the law asks us not to keep data from inactive accounts indefinitely. Any questions? Reply to this email, we read everything.",
            '',
            'Unsubscribe from emails: {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
    es: {
        subject: 'Tu cuenta Poteau se borra el {{DELETION_DATE}}',
        text: [
            'Cuánto tiempo, {{FIRST_NAME}}.',
            '',
            'Tu cuenta Poteau lleva tiempo dormida. Estamos limpiando las cuentas inactivas, y la tuya se borra el {{DELETION_DATE}} si no vuelves antes.',
            '',
            'Pero antes de que te vayas: {{NEW_PLAYERS}} jugadores nuevos se han unido a Poteau y se han jugado {{GAMES_PLAYED}} partidos desde tu último paso por aquí.',
            '',
            'La app también ha cambiado. Es más rápida, por fin se ve el marcador en directo durante el partido, y encontrar una plaza cerca de ti es cuestión de segundos.',
            '',
            'Tu perfil, tus estadísticas y tu historial siguen ahí. Abre la app una vez y todo vuelve a arrancar: {{CTA_URL}}',
            '',
            '¿Ya no juegas? No hagas nada, tu cuenta y tus datos se borrarán solos el {{DELETION_DATE}}.',
            '',
            'Te escribimos porque la ley nos pide no conservar indefinidamente los datos de cuentas inactivas. ¿Alguna duda? Responde a este correo, lo leemos todo.',
            '',
            'Dejar de recibir correos: {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
    it: {
        subject: 'Il tuo account Poteau sparisce il {{DELETION_DATE}}',
        text: [
            'Quanto tempo, {{FIRST_NAME}}.',
            '',
            "Il tuo account Poteau dorme da un po'. Stiamo facendo pulizia tra gli account inattivi, e il tuo sparisce il {{DELETION_DATE}} se non passi prima.",
            '',
            "Ma prima che tu vada: {{NEW_PLAYERS}} nuovi giocatori si sono iscritti a Poteau e sono state giocate {{GAMES_PLAYED}} partite dall'ultima volta che sei passato.",
            '',
            "Anche l'app è cambiata. È più veloce, finalmente si vede il punteggio in diretta durante la partita, e trovare un posto vicino a te richiede pochi secondi.",
            '',
            "Il tuo profilo, le tue statistiche e il tuo storico sono ancora lì. Apri l'app una volta e riparte tutto: {{CTA_URL}}",
            '',
            'Non giochi più? Non fare nulla, il tuo account e i tuoi dati spariranno da soli il {{DELETION_DATE}}.',
            '',
            'Ti scriviamo perché la legge ci chiede di non conservare a tempo indeterminato i dati degli account inattivi. Domande? Rispondi a questa e-mail, leggiamo tutto.',
            '',
            'Non ricevere più e-mail: {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
};

const REQUIRED_VARS = ['{{FIRST_NAME}}', '{{DELETION_DATE}}', '{{NEW_PLAYERS}}', '{{GAMES_PLAYED}}', '{{CTA_URL}}', '{{UNSUBSCRIBE_URL}}'];

async function main() {
    const dir = path.join(__dirname, 'templates', 'inactivity');
    let failures = 0;

    for (const [lang, meta] of Object.entries(LANGS)) {
        const file = path.join(dir, `InactivityEmail.${lang}.html`);
        if (!fs.existsSync(file)) {
            console.error(`MISSING ${file}`);
            failures++;
            continue;
        }
        const html = fs.readFileSync(file, 'utf8');

        // A template that silently lost a variable renders "{{DELETION_DATE}}"
        // as literal text in someone's inbox, or worse, an empty gap where the
        // date should be. Fail loudly instead.
        for (const v of REQUIRED_VARS) {
            if (!html.includes(v)) {
                console.error(`${lang}: HTML is missing ${v}`);
                failures++;
            }
        }
        if (!meta.subject.includes('{{DELETION_DATE}}')) {
            console.error(`${lang}: subject is missing {{DELETION_DATE}}`);
            failures++;
        }

        const name = `InactivityEmail_${lang}`;
        console.log(`${DRY ? '[dry] ' : ''}${name}  subject="${meta.subject}"  html=${html.length}b  text=${meta.text.length}b`);

        if (DRY) continue;

        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
        if (!accessKeyId || !secretAccessKey) {
            console.error('AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set. source ~/.poteau/aws_ses.env first.');
            process.exit(1);
        }
        const client = new SESv2Client({ region: REGION, credentials: { accessKeyId, secretAccessKey } });

        const content = { Subject: meta.subject, Html: html, Text: meta.text };
        try {
            await client.send(new CreateEmailTemplateCommand({ TemplateName: name, TemplateContent: content }));
            console.log(`  created ${name}`);
        } catch (err) {
            if (err.name === 'AlreadyExistsException') {
                await client.send(new UpdateEmailTemplateCommand({ TemplateName: name, TemplateContent: content }));
                console.log(`  updated ${name}`);
            } else {
                console.error(`  FAILED ${name}: ${err.message}`);
                failures++;
            }
        }
    }

    if (failures > 0) {
        console.error(`\n${failures === 1 ? '1 problem' : `${failures} problems`}.`);
        process.exit(1);
    }
    console.log(DRY ? '\nDry run OK.' : '\nAll templates deployed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
