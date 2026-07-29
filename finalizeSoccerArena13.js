/**
 * Post-creation fixes for the Soccer Arena 13 pro account.
 *
 * Brings the account in line with the conventions observed across the other
 * 51 real pro accounts:
 *
 *   1. Generate the QR code and store it in `qr_code`. Without it, the poster
 *      generation Cloud Function (index.js ~3244) bails out early and the
 *      centre never gets its printable in-centre poster.
 *   2. Set `auth_email: false`, matching the April 2025 backfill
 *      (authEmailFalseForPros.js) that every pro predating these scripts got.
 *   3. cached_centres priority 1 -> 2. Partner centres use 2
 *      (see checkAndFixPriorityCentres.js); 1 was copied from a one-off script.
 *   4. Drop `centre_address` from the cached_centres doc. Soccer Arena 13 was
 *      the only one of 1247 entries carrying it.
 *   5. Add the account to Prati United's `accounts` array — the head account
 *      (centres@poteau.team) that holds every other real pro.
 *
 * Not handled here: `alerts_centres`. The scheduled `populateAlertsCentres`
 * function (daily 06:23 Europe/Paris) creates that doc for every pro on its
 * own, so it appears without intervention.
 *
 * Idempotent: each step is a no-op if already applied.
 *
 * Run: node finalizeSoccerArena13.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
    storageBucket: 'krank-club.appspot.com',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const UID = 'Jmd7OmNaMwYhDEyGVYyeq7oxODC2';
const PLACE_ID = 'ChIJ_ylQMbH1yRIRm7p4aTebc3E';
const SHORT_NAME = 'soccer-arena-13';
const PRATI_UNITED_UID = 'zCvsukfMuuffsuPpSTQwb7MusMD2'; // centres@poteau.team

async function generateQrCode() {
    console.log('\n[1/5] QR code');
    const userSnap = await db.collection('users').doc(UID).get();
    if (userSnap.get('qr_code')) {
        console.log('      already set, skipping.');
        return;
    }

    // Matches generate_all_qr_codes.js: same URL shape, same storage path,
    // same long-lived signed URL.
    const url = `https://poteau.app/centre/${SHORT_NAME}`;
    const destination = `posters/${SHORT_NAME}_qr_code.png`;
    const tmpFile = path.join(os.tmpdir(), `${SHORT_NAME}_qr_code.png`);

    await QRCode.toFile(tmpFile, url, { type: 'png', errorCorrectionLevel: 'H' });
    await bucket.upload(tmpFile, { destination });
    fs.unlinkSync(tmpFile);

    const [signedUrl] = await bucket.file(destination).getSignedUrl({
        action: 'read',
        expires: '01-01-2500',
    });

    await db.collection('users').doc(UID).update({ qr_code: signedUrl });
    console.log(`      encodes: ${url}`);
    console.log(`      stored : ${destination}`);
}

async function setAuthEmail() {
    console.log('\n[2/5] auth_email');
    const userSnap = await db.collection('users').doc(UID).get();
    if (userSnap.get('auth_email') === false) {
        console.log('      already false, skipping.');
        return;
    }
    await db.collection('users').doc(UID).update({ auth_email: false });
    console.log('      set to false.');
}

async function fixCachedCentre() {
    console.log('\n[3/5] cached_centres priority');
    const ref = db.collection('cached_centres').doc(PLACE_ID);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`cached_centres/${PLACE_ID} does not exist.`);

    if (snap.get('priority') === 2) {
        console.log('      already 2, skipping.');
    } else {
        await ref.update({ priority: 2 });
        console.log(`      ${snap.get('priority')} -> 2.`);
    }

    console.log('\n[4/5] cached_centres centre_address');
    if (snap.get('centre_address') === undefined) {
        console.log('      already absent, skipping.');
    } else {
        await ref.update({ centre_address: admin.firestore.FieldValue.delete() });
        console.log('      removed (non-standard: only doc of 1247 with it).');
    }
}

async function linkToHeadAccount() {
    console.log('\n[5/5] Prati United head account');
    const ref = db.collection('users').doc(PRATI_UNITED_UID);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`Head account ${PRATI_UNITED_UID} not found.`);

    const accounts = snap.get('accounts') || [];
    if (accounts.includes(UID)) {
        console.log('      already linked, skipping.');
        return;
    }

    await ref.update({ accounts: admin.firestore.FieldValue.arrayUnion(UID) });
    console.log(`      added. ${accounts.length} -> ${accounts.length + 1} managed accounts.`);
}

async function main() {
    try {
        console.log('🔧 Finalizing Soccer Arena 13 (' + UID + ')');

        await generateQrCode();
        await setAuthEmail();
        await fixCachedCentre();
        await linkToHeadAccount();

        console.log('\n✅ All steps applied.\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main();
