/**
 * Backfill missing `qr_code` values on pro accounts.
 *
 * The poster generation Cloud Function (index.js ~3244) returns early unless
 * the account has BOTH `short_name` and `qr_code`. Several pros created by the
 * account-creation scripts never got a QR code, so they can never receive a
 * printable in-centre poster.
 *
 * Differences from generate_all_qr_codes.js, which should not be used:
 *   - That script has its `if (!user.qr_code)` guard commented out, so it
 *     regenerates and overwrites the URL for every pro that already has one.
 *   - It has no `short_name` guard, so an account without a slug gets a QR
 *     pointing at /centre/undefined.
 *   - It writes PNGs into a ./posters directory inside the repo.
 *
 * This version only touches accounts missing a qr_code, skips accounts with no
 * short_name, and writes temp files to the OS temp dir.
 *
 * Run:
 *   node backfillProQrCodes.js --dry-run   list what would change
 *   node backfillProQrCodes.js --send      generate and write
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

const isSet = (v) => v !== undefined && v !== null && v !== '';

async function generateFor(user) {
    // Same URL shape, storage path and long-lived signed URL as the original
    // generate_all_qr_codes.js, so backfilled entries are indistinguishable
    // from the ones already in the database.
    const url = `https://poteau.app/centre/${user.short_name}`;
    const destination = `posters/${user.short_name}_qr_code.png`;
    const tmpFile = path.join(os.tmpdir(), `${user.short_name}_qr_code.png`);

    await QRCode.toFile(tmpFile, url, { type: 'png', errorCorrectionLevel: 'H' });
    await bucket.upload(tmpFile, { destination });
    fs.unlinkSync(tmpFile);

    const [signedUrl] = await bucket.file(destination).getSignedUrl({
        action: 'read',
        expires: '01-01-2500',
    });

    await db.collection('users').doc(user.id).update({ qr_code: signedUrl });
    return { url, destination, signedUrl };
}

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send') || args.includes('-s');
    const dryRun = args.includes('--dry-run') || args.includes('-d');

    if (!send && !dryRun) {
        console.log('Usage:');
        console.log('  node backfillProQrCodes.js --dry-run   list what would change');
        console.log('  node backfillProQrCodes.js --send      generate and write');
        process.exit(1);
    }

    const snap = await db.collection('users').where('type', '==', 'pro').get();
    const real = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((u) => !u.is_test_account);

    const targets = real.filter((u) => isSet(u.short_name) && !isSet(u.qr_code));
    const skippedNoSlug = real.filter((u) => !isSet(u.short_name));
    const alreadyHave = real.filter((u) => isSet(u.qr_code));

    console.log(`\nReal pro accounts : ${real.length}`);
    console.log(`Already have QR   : ${alreadyHave.length} (left untouched)`);
    console.log(`No short_name     : ${skippedNoSlug.length} (cannot generate)`);
    skippedNoSlug.forEach((u) => console.log(`    - ${u.centre_name} (${u.id})`));
    console.log(`To generate       : ${targets.length}`);
    targets.forEach((u) => console.log(`    - ${u.short_name.padEnd(34)} ${u.centre_name}`));

    if (dryRun) {
        console.log('\n🔍 Dry run, nothing written.\n');
        process.exit(0);
    }

    console.log('');
    const results = { ok: [], failed: [] };

    for (const user of targets) {
        try {
            const { destination } = await generateFor(user);
            console.log(`✅ ${user.centre_name} -> ${destination}`);
            results.ok.push(user.centre_name);
        } catch (error) {
            console.error(`❌ ${user.centre_name}: ${error.message}`);
            results.failed.push({ name: user.centre_name, error: error.message });
        }
    }

    console.log(`\n=== Summary: ${results.ok.length} generated, ${results.failed.length} failed ===`);
    results.failed.forEach((f) => console.log(`  FAILED ${f.name}: ${f.error}`));
    process.exit(results.failed.length ? 1 : 0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
