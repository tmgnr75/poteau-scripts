/**
 * Deploy the OTC (one-time sign-up code) email templates to AWS SES.
 *
 * Creates or updates one SES template per language:
 *   OtcEmail_fr / OtcEmail_en / OtcEmail_es / OtcEmail_it
 *
 * Idempotent: tries Create, falls back to Update if the template already
 * exists, so re-running after a copy fix is safe.
 *
 * Usage:
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... node deployOtcEmails.js
 *   node deployOtcEmails.js --dry     # render + validate, send nothing
 *
 * Unlike the older create/update scripts in this directory, credentials are
 * read from the environment rather than hardcoded in source.
 */

const fs = require('fs');
const path = require('path');
const {
    SESv2Client,
    CreateEmailTemplateCommand,
    UpdateEmailTemplateCommand,
    GetEmailTemplateCommand,
} = require('@aws-sdk/client-sesv2');

const REGION = 'eu-north-1';
const DRY = process.argv.includes('--dry');

// Subject lines live in the SES template, so they are translated here.
// The code is interpolated so it is visible in the inbox list without
// opening the email -- that is the single biggest speed win for the user.
const LANGS = {
    fr: {
        subject: '{{OTC}} est ton code Poteau',
        text: 'Ton code de connexion Poteau : {{OTC}}\n\nSaisis-le dans l\'app pour terminer ton inscription.\n\nTu n\'as pas demande ce code ? Ignore cet e-mail, ton compte reste protege.',
    },
    en: {
        subject: '{{OTC}} is your Poteau code',
        text: 'Your Poteau sign-in code: {{OTC}}\n\nEnter it in the app to finish signing up.\n\nDidn\'t request this code? Just ignore this email, your account is safe.',
    },
    es: {
        subject: '{{OTC}} es tu codigo Poteau',
        text: 'Tu codigo de acceso Poteau: {{OTC}}\n\nIntroducelo en la app para terminar tu registro.\n\nNo has pedido este codigo? Ignora este correo, tu cuenta esta protegida.',
    },
    it: {
        subject: '{{OTC}} e il tuo codice Poteau',
        text: 'Il tuo codice di accesso Poteau: {{OTC}}\n\nInseriscilo nell\'app per completare la registrazione.\n\nNon hai richiesto questo codice? Ignora questa email, il tuo account e al sicuro.',
    },
};

function templateName(lang) {
    return `OtcEmail_${lang}`;
}

function loadHtml(lang) {
    const file = path.join(__dirname, 'templates', 'otc', `OtcEmail.${lang}.html`);
    const html = fs.readFileSync(file, 'utf8');

    // Guard against shipping a template whose only variable failed to convert
    // from the Brevo syntax -- that would email a literal "{{ params.OTC }}".
    if (html.includes('params.OTC')) {
        throw new Error(`${file}: still contains Brevo-style {{ params.OTC }}`);
    }
    if (!html.includes('{{OTC}}')) {
        throw new Error(`${file}: no {{OTC}} placeholder found`);
    }
    return html;
}

async function deployOne(client, lang) {
    const name = templateName(lang);
    const html = loadHtml(lang);
    const { subject, text } = LANGS[lang];

    const TemplateContent = { Subject: subject, Html: html, Text: text };

    if (DRY) {
        console.log(`   [dry] ${name}: subject="${subject}" html=${html.length}B text=${text.length}B`);
        return 'dry';
    }

    // SES has no upsert, so probe first and pick the matching command.
    let exists = false;
    try {
        await client.send(new GetEmailTemplateCommand({ TemplateName: name }));
        exists = true;
    } catch (err) {
        if (err.name !== 'NotFoundException') throw err;
    }

    const Command = exists ? UpdateEmailTemplateCommand : CreateEmailTemplateCommand;
    await client.send(new Command({ TemplateName: name, TemplateContent }));
    return exists ? 'updated' : 'created';
}

(async () => {
    if (!DRY && (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY)) {
        console.error('Missing AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment.');
        console.error('Re-run with --dry to validate the templates without deploying.');
        process.exit(1);
    }

    const client = new SESv2Client({
        region: REGION,
        credentials: DRY ? undefined : {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });

    console.log(DRY ? 'Validating OTC templates (dry run)...' : `Deploying OTC templates to SES (${REGION})...`);

    let failed = 0;
    for (const lang of Object.keys(LANGS)) {
        try {
            const result = await deployOne(client, lang);
            console.log(`   ${templateName(lang)}: ${result}`);
        } catch (err) {
            failed++;
            console.error(`   ${templateName(lang)}: FAILED - ${err.message}`);
        }
    }

    if (failed) {
        console.error(`\n${failed} template(s) failed.`);
        process.exit(1);
    }
    console.log('\nDone.');
})();
