#!/usr/bin/env node
/**
 * Recompress oversized user avatars already in Storage.
 *
 * The app now caps uploads (poteau-app upload_data.dart), but that only affects
 * NEW uploads. Measured 2026-08-24 across the whole users/ bucket: 141,450
 * objects / 27.2 GiB, of which 15,849 PNGs hold 61% of the bytes and 3,335
 * files over 1 MiB hold half. Most of those are full-screen phone screenshots
 * saved as PNG.
 *
 * Only ACTIVE users' photos are actually served, so egress follows them, not
 * the whole table: 106,668 users but 27,049 active in the last 90 days.
 *
 * Safety:
 *  - --dry by default. Nothing is written without --write.
 *  - Never enlarges a file; if the re-encode is not smaller, it is skipped.
 *  - Writes a NEW object and updates photo_url, leaving the original in place,
 *    so a bad result is revertible. Use --delete-originals only after review.
 *  - Verifies the re-encode decodes and has sane dimensions before uploading.
 *
 * Usage:
 *   node backfill_user_photos.js --dry --limit 50
 *   node backfill_user_photos.js --write --limit 500
 *   node backfill_user_photos.js --write            # all active users
 */
const admin = require('firebase-admin');
const sharp = require('sharp');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: 'krank-club',
    storageBucket: 'krank-club.appspot.com',
});

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const DELETE_ORIGINALS = args.includes('--delete-originals');
const ALL_USERS = args.includes('--all-users');
const LIMIT = (() => {
    const i = args.indexOf('--limit');
    return i >= 0 ? parseInt(args[i + 1], 10) : Infinity;
})();

// Match the client exactly (upload_data.dart): cap long edge, JPEG q82.
const MAX_EDGE = 1600;
const QUALITY = 82;
// Below this a file is not worth rewriting: the saving does not pay for a new
// object, a Firestore write and a cache miss for that user.
const MIN_BYTES = 400 * 1024;
// Rewrite only when it actually buys something.
const MIN_SAVING_RATIO = 0.15;
const ACTIVE_DAYS = 90;
const CONCURRENCY = 8;

const db = admin.firestore();
const bucket = admin.storage().bucket();

// Every mutation is appended here before it happens, so a revert never depends
// on reconstructing state from the bucket. One JSON object per line, flushed
// immediately -- a crash mid-run must still leave a usable manifest.
const fsSync = require('fs');
const MANIFEST = process.env.BACKFILL_MANIFEST ||
    `${__dirname}/backfill_manifest_${new Date().toISOString().slice(0, 10)}.jsonl`;
function record(entry) {
    fsSync.appendFileSync(MANIFEST, JSON.stringify(entry) + '\n');
}

function storagePathFromUrl(url) {
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded path>?...
    const m = /\/o\/([^?]+)/.exec(url);
    return m ? decodeURIComponent(m[1]) : null;
}

async function processUser(doc, stats) {
    const data = doc.data();
    const url = data.photo_url;
    if (!url || !url.startsWith('http')) { stats.skippedNoPhoto++; return; }

    const path = storagePathFromUrl(url);
    if (!path) { stats.skippedForeign++; return; }

    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists) { stats.skippedMissing++; return; }

    const [meta] = await file.getMetadata();
    const size = Number(meta.size || 0);
    if (size < MIN_BYTES) { stats.skippedSmall++; return; }

    const [buf] = await file.download();

    let out;
    try {
        const m = await sharp(buf).metadata();
        let p = sharp(buf).rotate(); // bake EXIF, same as the client
        if (Math.max(m.width, m.height) > MAX_EDGE) {
            p = p.resize(m.width >= m.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
        }
        out = await p.jpeg({ quality: QUALITY }).toBuffer();
    } catch (err) {
        stats.failedDecode++;
        console.warn(`  ! decode failed ${doc.id}: ${err.message}`);
        return;
    }

    // A marginal saving is not worth a new object, a Firestore write and a
    // cache miss for that user. Observed on the 2026-08-24 run: 7% of rewrites
    // saved under 15%, several of them 0%.
    if (out.length >= size * (1 - MIN_SAVING_RATIO)) { stats.skippedNotSmaller++; return; }

    // Verify before trusting it.
    const check = await sharp(out).metadata();
    if (!check.width || !check.height) { stats.failedVerify++; return; }

    stats.bytesBefore += size;
    stats.bytesAfter += out.length;
    stats.rewritten++;

    const pct = (100 * (1 - out.length / size)).toFixed(0);
    console.log(`  ${doc.id}  ${(size / 1024 / 1024).toFixed(1)}MB -> ${(out.length / 1024).toFixed(0)}KiB  -${pct}%`);

    if (!WRITE) return;

    const newPath = path.replace(/\.[^./]+$/, '') + `_c${MAX_EDGE}.jpg`;
    const token = require('crypto').randomUUID();
    // Recorded first: if the save or the update dies halfway, the revert still
    // knows which user to put back and what to put back.
    record({ uid: doc.id, oldUrl: url, oldPath: path, newPath, bytesBefore: size, bytesAfter: out.length });
    await bucket.file(newPath).save(out, {
        metadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=604800',
            metadata: { firebaseStorageDownloadTokens: token, recompressedFrom: path },
        },
        resumable: false,
    });
    const newUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
        `/o/${encodeURIComponent(newPath)}?alt=media&token=${token}`;
    await doc.ref.update({ photo_url: newUrl });

    if (DELETE_ORIGINALS) await file.delete().catch(() => {});
}

(async () => {
    const stats = {
        rewritten: 0, bytesBefore: 0, bytesAfter: 0,
        skippedNoPhoto: 0, skippedSmall: 0, skippedMissing: 0,
        skippedForeign: 0, skippedNotSmaller: 0, failedDecode: 0, failedVerify: 0,
    };

    let q = db.collection('users');
    if (!ALL_USERS) {
        const since = new Date(Date.now() - ACTIVE_DAYS * 86400e3);
        q = q.where('last_activity_date', '>=', since);
    }

    console.log(`mode: ${WRITE ? 'WRITE' : 'DRY RUN'}   scope: ${ALL_USERS ? 'all users' : `active ${ACTIVE_DAYS}d`}   limit: ${LIMIT}`);
    if (DELETE_ORIGINALS) console.log('!! --delete-originals: originals will be REMOVED');

    const snap = await q.get();
    const docs = snap.docs.slice(0, LIMIT === Infinity ? undefined : LIMIT);
    console.log(`candidates: ${docs.length}\n`);

    for (let i = 0; i < docs.length; i += CONCURRENCY) {
        await Promise.all(docs.slice(i, i + CONCURRENCY).map(d =>
            processUser(d, stats).catch(e => {
                stats.failedDecode++;
                console.warn(`  ! ${d.id}: ${e.message}`);
            })));
        if (i && i % 200 === 0) console.log(`  ...${i}/${docs.length}`);
    }

    const saved = stats.bytesBefore - stats.bytesAfter;
    console.log('\n--- summary ---');
    console.log(`rewritten        : ${stats.rewritten}`);
    console.log(`bytes before     : ${(stats.bytesBefore / 1024 ** 3).toFixed(2)} GiB`);
    console.log(`bytes after      : ${(stats.bytesAfter / 1024 ** 3).toFixed(2)} GiB`);
    console.log(`saved            : ${(saved / 1024 ** 3).toFixed(2)} GiB` +
        (stats.bytesBefore ? `  (-${(100 * saved / stats.bytesBefore).toFixed(1)}%)` : ''));
    console.log(`skipped (small)  : ${stats.skippedSmall}`);
    console.log(`skipped (no photo/foreign/missing): ${stats.skippedNoPhoto}/${stats.skippedForeign}/${stats.skippedMissing}`);
    console.log(`skipped (not smaller): ${stats.skippedNotSmaller}`);
    console.log(`failed           : ${stats.failedDecode + stats.failedVerify}`);
    if (!WRITE) console.log('\nDRY RUN — nothing written. Re-run with --write.');
})();
