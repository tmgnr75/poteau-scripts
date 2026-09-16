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
 *   {{SUBJECT}}         the subject line, chosen per recipient by the A/B arm
 *   {{FIRST_NAME}}      the person's first name, or a neutral fallback
 *   {{DELETION_DATE}}   localised date the account goes, e.g. "1er juin 2027"
 *   {{ACTIVITY_LINE}}   the HTML activity sentence (local or national)
 *   {{ACTIVITY_LINE_PLAIN}} the same sentence without markup, for the text part
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

/**
 * AWS credentials, from the environment or straight out of ~/.poteau/aws_ses.env.
 *
 * Reading the file here rather than relying on `source` matters: the values in
 * it are quoted, so passing them through `env VAR=$(grep ...)` hands SES a
 * secret with literal quote characters on both ends and the request fails with
 * SignatureDoesNotMatch, which reads like a wrong key rather than a quoting bug.
 *
 * Same helper as sendInactivityPreview.js, which has always done this. The
 * deploy script requiring a `source` when the preview script did not was a trap
 * of its own: the two are run back to back and only one of them needed it.
 */
function loadAwsCredentials() {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        return {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        };
    }
    const envFile = path.join(require('os').homedir(), '.poteau', 'aws_ses.env');
    if (!fs.existsSync(envFile)) return {};

    const out = {};
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
        const t = line.trim().replace(/^export\s+/, '');
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let value = t.slice(eq + 1).trim().replace(/\r$/, '');
        value = value.replace(/^(['"])(.*)\1$/, '$2');
        out[key] = value;
    }
    return {
        accessKeyId: out.AWS_ACCESS_KEY_ID,
        secretAccessKey: out.AWS_SECRET_ACCESS_KEY,
    };
}

// The subject is NOT stored in the template. It is supplied per recipient as
// {{SUBJECT}}, because the send runs a seven-arm subject-line test and
// SendTemplatedEmailCommand cannot override a stored subject. Storing them
// would mean seven templates per language, 28 in total, all needing to stay in
// sync through every copy change.
//
// The arms and their rationale live in gen2/enforceAccountRetention.js
// (SUBJECT_VARIANTS). Only French is split; EN, ES and IT get their own
// control subject from the same file.
const LANGS = {
    fr: {
        subject: '{{SUBJECT}}',
        text: [
            'Salut {{FIRST_NAME}},',
            '',
            "Ton compte Poteau n'a pas bougé depuis un moment. On ne garde pas les comptes inactifs éternellement, donc le tien sera supprimé le {{DELETION_DATE}}, avec toutes tes données.",
            '',
            'Sauf si tu repasses avant. Et avant que tu partes, deux minutes.',
            '',
            "POTEAU, ÇA TE DIT PLUS RIEN ?",
            "C'est pas grave, on t'en veut pas. En gros : tu ouvres l'app, tu vois les matchs de foot près de chez toi, tu prends une place, tu joues. Pas besoin d'avoir une équipe, c'est même fait pour ceux qui n'en ont pas.",
            '',
            'TU AS ARRÊTÉ LE FOOT ?',
            "On en doute. Ce qui arrive souvent, c'est plutôt ça : tu t'inscris, tu regardes les matchs, et personne ne te connaît. Se pointer seul chez des inconnus, c'est la partie difficile. La plupart des gens s'arrêtent là.",
            '',
            "C'est exactement ce qu'on a passé deux ans à réparer :",
            '- Ton niveau, de 1 à 10.',
            '- Des vrais profils : poste, niveau, matchs joués.',
            "- La compo en un coup d'œil, avant de t'inscrire.",
            '- Cartons jaunes et rouges pour ceux qui ne viennent pas.',
            '- Plus de 50 centres partenaires.',
            '',
            '{{ACTIVITY_LINE_PLAIN}}',
            "Il y en a sûrement un cette semaine qui t'irait : {{CTA_URL}}",
            '',
            'Et si vraiment tu as tourné la page, ne fais rien. Le {{DELETION_DATE}}, ton compte et tes données partent tout seuls.',
            '',
            "L'équipe Poteau",
            '',
            "On t'écrit parce que la loi nous demande de ne pas garder les données de comptes inactifs indéfiniment.",
            "Ne plus recevoir d'e-mails : {{UNSUBSCRIBE_URL}}",
        ].join('\n'),
    },
    en: {
        subject: '{{SUBJECT}}',
        text: [
            'Hi {{FIRST_NAME}},',
            '',
            "Your Poteau account has been quiet for a while. We don't keep inactive accounts forever, so yours will be deleted on {{DELETION_DATE}}, along with all your data.",
            '',
            'Unless you drop by before then. And before you go, two minutes.',
            '',
            "POTEAU DOESN'T RING A BELL?",
            "No worries, we're not offended. Short version: you open the app, you see the football games near you, you take a spot, you play. No need for a team, it's actually built for people who don't have one.",
            '',
            'GIVEN UP FOOTBALL?',
            "We doubt it. Here's what usually happens instead: you sign up, you look at the games, and nobody knows you. Turning up alone among strangers is the hard part. Most people stop right there.",
            '',
            "That's exactly what we spent two years fixing:",
            '- Your level, from 1 to 10.',
            '- Real profiles: position, level, games played.',
            '- The line-up at a glance, before you sign up.',
            "- Yellow and red cards for people who don't show up.",
            '- Over 50 partner venues.',
            '',
            '{{ACTIVITY_LINE_PLAIN}}',
            "There's probably one this week that would suit you: {{CTA_URL}}",
            '',
            "And if you've genuinely moved on, do nothing. On {{DELETION_DATE}}, your account and your data go on their own.",
            '',
            'The Poteau Team',
            '',
            "We're writing because the law asks us not to keep data from inactive accounts indefinitely.",
            'Unsubscribe from emails: {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
    es: {
        subject: '{{SUBJECT}}',
        text: [
            'Hola {{FIRST_NAME}},',
            '',
            'Tu cuenta Poteau lleva tiempo parada. No guardamos las cuentas inactivas para siempre, así que la tuya se borrará el {{DELETION_DATE}}, con todos tus datos.',
            '',
            'A menos que vuelvas antes. Y antes de que te vayas, dos minutos.',
            '',
            '¿POTEAU NO TE SUENA DE NADA?',
            'Tranquilo, no nos lo tomamos a mal. En resumen: abres la app, ves los partidos de fútbol cerca de ti, coges una plaza y juegas. No hace falta tener equipo, de hecho está pensado para quien no lo tiene.',
            '',
            '¿HAS DEJADO EL FÚTBOL?',
            'Lo dudamos. Lo que suele pasar es más bien esto: te registras, miras los partidos, y nadie te conoce. Presentarte solo entre desconocidos es la parte difícil. La mayoría se queda ahí.',
            '',
            'Es exactamente lo que hemos pasado dos años arreglando:',
            '- Tu nivel, del 1 al 10.',
            '- Perfiles de verdad: posición, nivel, partidos jugados.',
            '- La alineación de un vistazo, antes de apuntarte.',
            '- Tarjetas amarillas y rojas para quien no aparece.',
            '- Más de 50 centros asociados.',
            '',
            '{{ACTIVITY_LINE_PLAIN}}',
            'Seguro que hay uno esta semana que te iría bien: {{CTA_URL}}',
            '',
            'Y si de verdad has pasado página, no hagas nada. El {{DELETION_DATE}}, tu cuenta y tus datos se van solos.',
            '',
            'El equipo Poteau',
            '',
            'Te escribimos porque la ley nos pide no conservar indefinidamente los datos de cuentas inactivas.',
            'Dejar de recibir correos: {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
    it: {
        subject: '{{SUBJECT}}',
        text: [
            'Ciao {{FIRST_NAME}},',
            '',
            "Il tuo account Poteau è fermo da un po'. Non teniamo gli account inattivi per sempre, quindi il tuo sarà eliminato il {{DELETION_DATE}}, con tutti i tuoi dati.",
            '',
            'A meno che tu non passi prima. E prima che tu vada, due minuti.',
            '',
            'POTEAU NON TI DICE PIÙ NIENTE?',
            "Tranquillo, non ce la prendiamo. In breve: apri l'app, vedi le partite di calcio vicino a te, prendi un posto, giochi. Non serve avere una squadra, anzi è fatto per chi non ce l'ha.",
            '',
            'HAI SMESSO DI GIOCARE?',
            'Ne dubitiamo. Quello che succede di solito è piuttosto questo: ti iscrivi, guardi le partite, e nessuno ti conosce. Presentarsi da soli tra sconosciuti è la parte difficile. La maggior parte si ferma lì.',
            '',
            'È esattamente quello che abbiamo passato due anni a sistemare:',
            '- Il tuo livello, da 1 a 10.',
            '- Profili veri: ruolo, livello, partite giocate.',
            "- La formazione a colpo d'occhio, prima di iscriverti.",
            '- Cartellini gialli e rossi per chi non si presenta.',
            '- Oltre 50 centri partner.',
            '',
            '{{ACTIVITY_LINE_PLAIN}}',
            'Ce ne sarà sicuramente una questa settimana che fa per te: {{CTA_URL}}',
            '',
            'E se hai davvero voltato pagina, non fare nulla. Il {{DELETION_DATE}}, il tuo account e i tuoi dati spariscono da soli.',
            '',
            'Il team Poteau',
            '',
            'Ti scriviamo perché la legge ci chiede di non conservare a tempo indeterminato i dati degli account inattivi.',
            'Non ricevere più e-mail : {{UNSUBSCRIBE_URL}}',
        ].join('\n'),
    },
};

const REQUIRED_VARS = ['{{FIRST_NAME}}', '{{DELETION_DATE}}', '{{ACTIVITY_LINE}}', '{{CTA_URL}}', '{{UNSUBSCRIBE_URL}}'];

// The text part cannot carry <strong>, so it gets its own plain variable. Both
// must be supplied by the sender or SES renders the literal braces.
const REQUIRED_TEXT_VARS = ['{{ACTIVITY_LINE_PLAIN}}'];

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
        // The subject is supplied per recipient, not stored, because the send
        // runs a seven-arm subject-line test and SendTemplatedEmailCommand
        // cannot override a stored subject. Seven arms x four languages would
        // otherwise be 28 templates to keep in sync.
        if (!meta.subject.includes('{{SUBJECT}}')) {
            console.error(`${lang}: subject must be {{SUBJECT}}, supplied by the sender`);
            failures++;
        }

        const name = `InactivityEmail_${lang}`;
        console.log(`${DRY ? '[dry] ' : ''}${name}  subject="${meta.subject}"  html=${html.length}b  text=${meta.text.length}b`);

        if (DRY) continue;

        const { accessKeyId, secretAccessKey } = loadAwsCredentials();
        if (!accessKeyId || !secretAccessKey) {
            console.error('No AWS credentials in the environment or in ~/.poteau/aws_ses.env');
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
