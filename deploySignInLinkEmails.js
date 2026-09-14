/**
 * Deploy the Poteau Max sign-in link (magic link) email templates to AWS SES.
 *
 * Creates or updates one SES template per language:
 *   SignInLinkEmail_fr / _en / _es / _it
 *
 * WHY THESE EXIST
 * ---------------
 * The pro magic link was the last flow still sent through Brevo. On
 * 2026-09-14 the Brevo account hit 0 pay-as-you-go credits and every sign-in
 * email stopped being delivered, silently: Brevo still returned a messageId,
 * so `sendSignInLink` logged "Brevo email sent successfully" while nothing
 * left the building.
 *
 * Three partner centres were locked out before anyone noticed, one of them for
 * five days:
 *   2026-09-04  bezons@lefive.fr
 *   2026-09-09  contact@lepark.fr   (LE PARK, on its onboarding day)
 *   2026-09-14  team@realfive.fr    (RealFive, on its onboarding day)
 *
 * SES is where every other Poteau email already lives, it has production
 * access and a 100k/day quota, and a hard failure there surfaces as a real
 * error rather than a cheerful log line.
 *
 * The HTML is ported from Brevo templates 1040/1041/1042/1043 with one
 * mechanical change: Brevo's `{{params.X}}` becomes SES's `{{X}}`. The design,
 * the copy and the four subject lines are unchanged, so centres see the same
 * email they always did.
 *
 * The HTML lives in scripts/templates/signin/ and this script is the only way
 * to push it. Editing the file alone changes nothing until you re-run this.
 * Same trap as GenericEmail.html / InvitationEmail.html / the OTC templates.
 *
 * Usage:
 *   node deploySignInLinkEmails.js --dry    render + validate, write nothing
 *   node deploySignInLinkEmails.js          create or update the templates
 *
 * Credentials come from the environment:
 *   set -a; . ~/.poteau/aws_ses.env; set +a
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
const TEMPLATE_DIR = path.join(__dirname, 'templates', 'signin');

// Subject lines live in the SES template. These are the exact strings the
// Brevo templates used, so the inbox looks identical after the migration.
//
// The plain-text part is fully accented, like the HTML. Some clients show it
// instead of the HTML, and an unaccented "Ta demande a ete validee" reads as
// broken rather than as a fallback. SES stores UTF-8, so there is no reason to
// strip them.
const LANGS = {
    fr: {
        subject: "Ton lien de connexion est à l'intérieur",
        text:
            'Ta demande de connexion a été validée.\n\n' +
            'Ouvre Poteau Max : {{SignInLink}}\n\n' +
            "Ce lien n'est valable qu'une seule fois et expire dans une heure.\n\n" +
            "Si tu n'as pas demandé à recevoir ce mail, supprime-le et tout ira bien.\n\n" +
            'La team Poteau Max',
    },
    en: {
        subject: 'Your sign-in link is inside',
        text:
            'Your sign-in request has been approved.\n\n' +
            'Open Poteau Max: {{SignInLink}}\n\n' +
            'This link works once and expires in an hour.\n\n' +
            "Didn't ask for this email? Just delete it, everything is fine.\n\n" +
            'The Poteau Max team',
    },
    es: {
        subject: 'Tu enlace de acceso está aquí',
        text:
            'Tu solicitud de acceso ha sido aprobada.\n\n' +
            'Abre Poteau Max: {{SignInLink}}\n\n' +
            'Este enlace solo funciona una vez y caduca en una hora.\n\n' +
            '¿No has pedido este correo? Bórralo, todo está bien.\n\n' +
            'El equipo Poteau Max',
    },
    it: {
        subject: 'Il tuo link di accesso è qui',
        text:
            'La tua richiesta di accesso è stata approvata.\n\n' +
            'Apri Poteau Max: {{SignInLink}}\n\n' +
            "Questo link funziona una sola volta e scade tra un'ora.\n\n" +
            'Non hai richiesto questa email? Cancellala, va tutto bene.\n\n' +
            'Il team Poteau Max',
    },
};

const client = new SESv2Client({ region: REGION });

function templateName(lang) {
    return `SignInLinkEmail_${lang}`;
}

function readHtml(lang) {
    const file = path.join(TEMPLATE_DIR, `SignInLinkEmail.${lang}.html`);
    if (!fs.existsSync(file)) throw new Error(`Missing template file: ${file}`);
    const html = fs.readFileSync(file, 'utf8');

    // A Brevo placeholder left behind would render literally in a real email.
    const brevoLeftovers = html.match(/\{\{[^}]*params\.[^}]*\}\}/g);
    if (brevoLeftovers) {
        throw new Error(`${lang}: Brevo placeholders still present: ${brevoLeftovers.join(', ')}`);
    }

    // Both variables must survive the port, or the email is useless: no link
    // to click, or a broken QR image.
    for (const required of ['{{SignInLink}}', '{{QrCode}}']) {
        if (!html.includes(required)) {
            throw new Error(`${lang}: template does not contain ${required}`);
        }
    }
    return html;
}

async function deployOne(lang) {
    const name = templateName(lang);
    const html = readHtml(lang);
    const { subject, text } = LANGS[lang];

    console.log(`\n${name}`);
    console.log(`   subject : ${subject}`);
    console.log(`   html    : ${html.length} bytes`);

    if (DRY) {
        console.log('   -> dry run, nothing written');
        return;
    }

    const content = { Subject: subject, Html: html, Text: text };

    try {
        await client.send(
            new CreateEmailTemplateCommand({ TemplateName: name, TemplateContent: content })
        );
        console.log('   -> created');
    } catch (error) {
        if (error.name !== 'AlreadyExistsException') throw error;
        await client.send(
            new UpdateEmailTemplateCommand({ TemplateName: name, TemplateContent: content })
        );
        console.log('   -> updated');
    }

    // Read it back: a template that did not land is the whole failure mode
    // this migration exists to remove.
    const check = await client.send(new GetEmailTemplateCommand({ TemplateName: name }));
    const landed = check.TemplateContent || {};
    if (landed.Subject !== subject) {
        throw new Error(`${name}: subject did not land (got ${landed.Subject})`);
    }
    if (!landed.Html || !landed.Html.includes('{{SignInLink}}')) {
        throw new Error(`${name}: html did not land intact`);
    }
    console.log('   -> verified on SES');
}

async function main() {
    console.log(DRY ? 'MODE: DRY RUN' : 'MODE: DEPLOY');
    console.log(`Region: ${REGION}`);
    console.log(`Source: ${TEMPLATE_DIR}`);

    for (const lang of Object.keys(LANGS)) {
        await deployOne(lang);
    }

    console.log(
        DRY
            ? '\n✅ Dry run complete. Re-run without --dry to deploy.\n'
            : '\n✅ All four templates deployed and verified.\n'
    );
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.name || '', error.message);
    process.exit(1);
});
