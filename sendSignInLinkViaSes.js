/**
 * Send a Poteau Max sign-in link (magic link) to a pro account, through SES.
 *
 * This is the manual counterpart of the `sendSignInLink` Cloud Function: same
 * link, same QR code, same templates. Use it to unblock a centre by hand
 * without waiting for them to tap "send me a code" in the app.
 *
 * WHY IT EXISTS
 * -------------
 * On 2026-09-14 the Brevo account hit 0 credits and silently stopped
 * delivering every pro magic link. Three centres were locked out of their
 * brand new accounts, one for five days, and nothing in our logs said so:
 * Brevo returned a messageId and the function logged success.
 *
 * Two things follow from that, and both are built into this script:
 *   - it sends through SES, where a failure is a thrown error, not a log line
 *   - it VERIFIES before it claims anything, by reading back the SES
 *     MessageId, and it refuses to pretend a send happened
 *
 * WHAT IT DOES
 *   1. Generates a Firebase sign-in link for the address (one use, ~1h)
 *   2. Renders a QR of that link and uploads it to Storage, like the Cloud
 *      Function does, so the centre can scan it from a desktop inbox
 *   3. Sends the SignInLinkEmail_<lang> SES template
 *
 * Usage:
 *   node sendSignInLinkViaSes.js --email <addr> --dry-run
 *   node sendSignInLinkViaSes.js --email <addr> --send
 *   node sendSignInLinkViaSes.js --email <addr> --send --lang en
 *
 * Credentials:
 *   set -a; . ~/.poteau/aws_ses.env; set +a
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const admin = require('firebase-admin');
const QRCode = require('qrcode');
const { SESv2Client, SendEmailCommand } = require('@aws-sdk/client-sesv2');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const REGION = 'eu-north-1';
const CONFIG_SET = 'signin-emails';

// poteau.app is the verified identity (DKIM SUCCESS, MAIL FROM
// mail.poteau.app). The old Brevo sender (team-max@poteau-mail.com) is a
// domain we do not send from on SES, so it is deliberately not reused.
const SENDER = 'Poteau Max <no-reply@mail.poteau.app>';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
    storageBucket: 'krank-club.appspot.com',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();
const ses = new SESv2Client({ region: REGION });

function arg(flag) {
    const i = process.argv.indexOf(flag);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const EMAIL = arg('--email');
const SEND = process.argv.includes('--send');
const DRY = process.argv.includes('--dry-run');
const LANG_OVERRIDE = arg('--lang');

async function resolveAccount(email) {
    const user = await admin.auth().getUserByEmail(email);

    const snap = await db.collection('users').doc(user.uid).get();
    if (!snap.exists) throw new Error(`users/${user.uid} does not exist for ${email}.`);

    const type = snap.get('type');
    if (type !== 'pro' && type !== 'super_pro') {
        throw new Error(`${email} is type "${type}", not a pro account. Aborting.`);
    }

    return {
        uid: user.uid,
        centreName: snap.get('centre_name') || snap.get('display_name'),
        language: LANG_OVERRIDE || snap.get('language') || 'fr',
        lastSignIn: user.metadata.lastSignInTime,
    };
}

async function buildSignInLink(email) {
    return admin.auth().generateSignInWithEmailLink(email, {
        url: `https://poteau.app/poteauboost-magiclink?email=${encodeURIComponent(email)}`,
        handleCodeInApp: false,
    });
}

async function uploadQrCode(signInLink) {
    const fileName = `qr_codes/signInQR_${Date.now()}.png`;
    const tmpFile = path.join(os.tmpdir(), `signInQR_${Date.now()}.png`);

    await QRCode.toFile(tmpFile, signInLink, { type: 'png', errorCorrectionLevel: 'H' });
    const file = bucket.file(fileName);
    await file.save(fs.readFileSync(tmpFile), { contentType: 'image/png' });
    await file.makePublic();
    fs.unlinkSync(tmpFile);

    return file.publicUrl();
}

async function main() {
    if (!EMAIL || (!SEND && !DRY)) {
        console.log('Usage:');
        console.log('  node sendSignInLinkViaSes.js --email <addr> --dry-run');
        console.log('  node sendSignInLinkViaSes.js --email <addr> --send [--lang fr|en|es|it]');
        process.exit(1);
    }

    const account = await resolveAccount(EMAIL);
    const template = `SignInLinkEmail_${account.language}`;

    console.log('\n=== SIGN-IN LINK ===');
    console.log('  centre     :', account.centreName);
    console.log('  email      :', EMAIL);
    console.log('  uid        :', account.uid);
    console.log('  language   :', account.language, `(template ${template})`);
    console.log('  lastSignIn :', account.lastSignIn || 'NEVER SIGNED IN');
    console.log('  sender     :', SENDER);

    if (DRY) {
        // Still generate the link in a dry run: if Firebase refuses, we want
        // to know now rather than at send time.
        const link = await buildSignInLink(EMAIL);
        console.log('  link       :', link.slice(0, 90) + '...');
        console.log('\n🔍 Dry run, no email sent and no QR uploaded.');
        process.exit(0);
    }

    const signInLink = await buildSignInLink(EMAIL);
    const qrCodeUrl = await uploadQrCode(signInLink);
    console.log('  qr         :', qrCodeUrl);

    const result = await ses.send(
        new SendEmailCommand({
            FromEmailAddress: SENDER,
            Destination: { ToAddresses: [EMAIL] },
            ConfigurationSetName: CONFIG_SET,
            Content: {
                Template: {
                    TemplateName: template,
                    TemplateData: JSON.stringify({ SignInLink: signInLink, QrCode: qrCodeUrl }),
                },
            },
        })
    );

    // SES only returns a MessageId once it has accepted the message for
    // delivery. No MessageId means no send, and we say so rather than
    // reporting a success we cannot prove.
    if (!result.MessageId) {
        throw new Error('SES returned no MessageId. Treating this as NOT sent.');
    }

    console.log('\n✅ Sent through SES.');
    console.log('   MessageId:', result.MessageId);
    console.log('   The link works once and expires in about an hour.\n');
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.name || '', error.message);
    process.exit(1);
});
