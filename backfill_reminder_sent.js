/**
 * Backfill `reminder_sent: false` on pending game_invitations.
 *
 * WHY: sendReminders now filters on `reminder_sent == false` so it stops
 * re-reading invitations it already handled (that re-scan was ~16M reads/day,
 * the bulk of the Firestore read bill). Firestore equality cannot match a
 * missing field, so any invitation created before that change is invisible to
 * the new query and would never get its H-48 reminder.
 *
 * RUN THIS BEFORE DEPLOYING the sendReminders change.
 *
 * Scope: only `status == 'pending'` invitations for games still in the future.
 * Past or non-pending invitations will never be reminded anyway, so writing to
 * them would cost money for nothing — there are millions of them.
 *
 * Idempotent: re-running skips docs that already have the field.
 *
 *   node scripts/backfill_reminder_sent.js --dry-run
 *   node scripts/backfill_reminder_sent.js
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 500;

(async () => {
    // Only future games can still receive an H-48 reminder.
    const now = admin.firestore.Timestamp.now();
    let cursor = null;
    let scanned = 0, written = 0, alreadySet = 0;

    console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');

    for (;;) {
        let q = db.collection('game_invitations')
            .where('status', '==', 'pending')
            .where('game_date', '>=', now)
            .orderBy('game_date')
            .limit(PAGE);
        if (cursor) q = q.startAfter(cursor);

        const snap = await q.get();
        if (snap.empty) break;

        const batch = db.batch();
        let inBatch = 0;

        for (const doc of snap.docs) {
            scanned++;
            if (doc.get('reminder_sent') !== undefined) { alreadySet++; continue; }
            if (!DRY_RUN) {
                batch.update(doc.ref, { reminder_sent: false });
                inBatch++;
            }
            written++;
        }

        if (inBatch > 0) await batch.commit();
        cursor = snap.docs[snap.docs.length - 1];
        console.log(`  scanned=${scanned} needsField=${written} alreadySet=${alreadySet}`);

        if (snap.size < PAGE) break;
    }

    console.log(`\nDone. scanned=${scanned}, ${DRY_RUN ? 'would write' : 'written'}=${written}, skipped=${alreadySet}`);
    process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
