/**
 * Send the inactivity-warning email to a test address, to see what it looks like.
 *
 * Sends the real HTML from scripts/templates/inactivity/ with realistic values
 * filled in, using SES SendEmail rather than a stored template, so the copy can
 * be reviewed WITHOUT first deploying it to SES.
 *
 * Usage:
 *   source ~/.poteau/aws_ses.env
 *   node sendInactivityPreview.js t.genreau@me.com
 *   node sendInactivityPreview.js t.genreau@me.com --lang en
 *   node sendInactivityPreview.js t.genreau@me.com --generic   # national line
 *
 * The default renders the local variant (a city with real activity). --generic
 * renders the fallback used for the 18% with no usable city and for anyone whose
 * area has fewer than 20 games a month.
 */

const fs = require('fs');
const path = require('path');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const REGION = 'eu-north-1';
const SOURCE = 'Poteau <no-reply@mail.poteau.app>';

const to = process.argv[2];
if (!to || to.startsWith('--')) {
    console.error('Usage: node sendInactivityPreview.js <email> [--lang fr|en|es|it] [--generic]');
    process.exit(1);
}

const langArg = process.argv.indexOf('--lang');
const LANG = langArg !== -1 ? process.argv[langArg + 1] : 'fr';
const GENERIC = process.argv.includes('--generic');

// Realistic sample values. The date is a real one, a month out, formatted the way
// the function formats it.
const deletionDate = new Date(Date.now() + 30 * 24 * 3600 * 1000)
    .toLocaleDateString(
        { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT' }[LANG] || 'fr-FR',
        { day: 'numeric', month: 'long', year: 'numeric' }
    );

const ACTIVITY_LINE = {
    fr: GENERIC
        ? 'La semaine dernière, <strong style="color:#141414;">4 115 matchs</strong> ont été joués sur Poteau.'
        : 'Le mois dernier, il y a eu <strong style="color:#141414;">254 matchs à moins de 15 km de Marseille</strong>.',
    en: GENERIC
        ? 'Last week, <strong style="color:#141414;">4,115 games</strong> were played on Poteau.'
        : 'Last month there were <strong style="color:#141414;">254 games within 15 km of Marseille</strong>.',
    es: GENERIC
        ? 'La semana pasada se jugaron <strong style="color:#141414;">4115 partidos</strong> en Poteau.'
        : 'El mes pasado hubo <strong style="color:#141414;">254 partidos a menos de 15 km de Marsella</strong>.',
    it: GENERIC
        ? 'La settimana scorsa sono state giocate <strong style="color:#141414;">4.115 partite</strong> su Poteau.'
        : 'Il mese scorso ci sono state <strong style="color:#141414;">254 partite a meno di 15 km da Marsiglia</strong>.',
}[LANG];

const SUBJECTS = {
    fr: `Ton Poteau part le ${deletionDate}`,
    en: `Your Poteau goes on ${deletionDate}`,
    es: `Tu Poteau se borra el ${deletionDate}`,
    it: `Il tuo Poteau sparisce il ${deletionDate}`,
};

const VALUES = {
    FIRST_NAME: 'Tim',
    DELETION_DATE: deletionDate,
    ACTIVITY_LINE,
    CTA_URL: 'https://onelink.to/poteau-app',
    UNSUBSCRIBE_URL: 'https://poteau-app.com/unsubscribe?uid=preview&ml=' + encodeURIComponent(to),
    // Kept for the older template revisions that still reference them.
    NEW_PLAYERS: '98 000',
    GAMES_PLAYED: '212 000',
};

/**
 * AWS credentials, from the environment or straight out of ~/.poteau/aws_ses.env.
 *
 * Reading the file here rather than relying on `source` matters: the values in it
 * are quoted, so passing them through `env VAR=$(grep ...)` hands SES a secret
 * with literal quote characters on both ends and the request fails with
 * SignatureDoesNotMatch, which reads like a wrong key rather than a quoting bug.
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

function render(html) {
    let out = html;
    for (const [k, v] of Object.entries(VALUES)) {
        out = out.split(`{{${k}}}`).join(v);
    }
    const leftover = out.match(/\{\{[A-Z_]+\}\}/g);
    if (leftover) {
        console.error(`\nUnfilled variables still in the HTML: ${[...new Set(leftover)].join(', ')}`);
        console.error('Fill them in VALUES above, or the recipient sees the raw braces.');
        process.exit(1);
    }
    return out;
}

async function main() {
    const file = path.join(__dirname, 'templates', 'inactivity', `InactivityEmail.${LANG}.html`);
    if (!fs.existsSync(file)) {
        console.error(`No template for "${LANG}" at ${file}`);
        process.exit(1);
    }

    const html = render(fs.readFileSync(file, 'utf8'));
    const subject = SUBJECTS[LANG] || SUBJECTS.fr;

    const { accessKeyId, secretAccessKey } = loadAwsCredentials();
    if (!accessKeyId || !secretAccessKey) {
        console.error('No AWS credentials in the environment or in ~/.poteau/aws_ses.env');
        process.exit(1);
    }

    const client = new SESClient({ region: REGION, credentials: { accessKeyId, secretAccessKey } });

    await client.send(new SendEmailCommand({
        Destination: { ToAddresses: [to] },
        Source: SOURCE,
        Message: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: html, Charset: 'UTF-8' } },
        },
        // No ConfigurationSetName: a preview must not land in the campaign metrics.
    }));

    console.log(`Sent to ${to}`);
    console.log(`  language: ${LANG}`);
    console.log(`  variant:  ${GENERIC ? 'national fallback' : 'local city'}`);
    console.log(`  subject:  ${subject}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
