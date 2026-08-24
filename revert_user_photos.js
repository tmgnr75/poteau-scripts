#!/usr/bin/env node
/**
 * Undo a backfill_user_photos.js run.
 *
 * Reads the manifest that run appended (one JSON object per line, written
 * BEFORE each mutation) and puts photo_url back to the original URL. The
 * originals are left in place by the backfill unless --delete-originals was
 * used, so this is a pointer swap, not a restore from backup.
 *
 * Verifies the original object still exists before repointing at it -- a
 * revert that leaves users with a 404 avatar is worse than the thing it undoes.
 *
 * Usage:
 *   node revert_user_photos.js --manifest backfill_manifest_2026-08-24.jsonl --dry
 *   node revert_user_photos.js --manifest backfill_manifest_2026-08-24.jsonl --write
 *   node revert_user_photos.js --manifest ... --write --delete-new   # also bin the rewritten files
 */
const admin = require('firebase-admin');
const fs = require('fs');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: 'krank-club',
    storageBucket: 'krank-club.appspot.com',
});

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const DELETE_NEW = args.includes('--delete-new');
const mi = args.indexOf('--manifest');
const MANIFEST = mi >= 0 ? args[mi + 1] : null;

if (!MANIFEST || !fs.existsSync(MANIFEST)) {
    console.error('need --manifest <file>');
    process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

(async () => {
    const entries = fs.readFileSync(MANIFEST, 'utf8')
        .split('\n').filter(Boolean).map(l => JSON.parse(l));

    console.log(`mode: ${WRITE ? 'WRITE' : 'DRY RUN'}   entries: ${entries.length}`);

    let reverted = 0, skippedChanged = 0, missingOriginal = 0, alreadyOk = 0, failed = 0;

    for (const e of entries) {
        try {
            const ref = db.collection('users').doc(e.uid);
            const snap = await ref.get();
            if (!snap.exists) { failed++; continue; }
            const cur = snap.data().photo_url || '';

            if (cur === e.oldUrl) { alreadyOk++; continue; }
            // Someone changed their photo after the backfill -- their choice wins.
            if (!cur.includes(encodeURIComponent(e.newPath)) && !cur.includes(e.newPath)) {
                skippedChanged++;
                continue;
            }
            const [exists] = await bucket.file(e.oldPath).exists();
            if (!exists) { missingOriginal++; continue; }

            console.log(`  ${e.uid} -> original`);
            if (WRITE) {
                await ref.update({ photo_url: e.oldUrl });
                if (DELETE_NEW) await bucket.file(e.newPath).delete().catch(() => {});
            }
            reverted++;
        } catch (err) {
            failed++;
            console.warn(`  ! ${e.uid}: ${err.message}`);
        }
    }

    console.log('\n--- summary ---');
    console.log(`reverted            : ${reverted}`);
    console.log(`already original    : ${alreadyOk}`);
    console.log(`skipped (user changed photo since): ${skippedChanged}`);
    console.log(`skipped (original gone): ${missingOriginal}`);
    console.log(`failed              : ${failed}`);
    if (!WRITE) console.log('\nDRY RUN — nothing written.');
})();
