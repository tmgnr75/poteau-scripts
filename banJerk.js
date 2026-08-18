/**
 * Poteau | One-off script: set banned == true on specific users
 * Usage:
 *   node ban_users.js
 *   DRY_RUN=1 node ban_users.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const COLLECTION = 'users';
const DRY_RUN = !!process.env.DRY_RUN;
const BATCH_SIZE = 400;

const RAW_PAIRS = [
    ['3TJx3XZppJURbhoZotHLsnBWE6h1', '1080736693439'],
    ['3aPnh25mezL0Olt3oxpTmjCy0VI3', '1175684764998'],
    ['A7zfLjw28ignrxH87HBO33G9Uy22', '1080673357268'],
    ['Bais4cwhY5QWkX8mPcxAow8i0gS2', '1080423649717'],
    ['EB8lrOV04kbjnuPzMbHPSPGYlzD3', '1080480250762'],
    ['KH0W56skYqhceq0yrl3q1CvLQSJ3', '1080746858383'],
    ['MaADpbZ2Rvbtjch78oV2GPllI9h2', '1080659384004'],
    ['RagXkj68JBb4lWiBmDMGKKX8ZUL2', '1080652804577'],
    ['Trrxt1oEEweeKlL6Wv0R56j6gJl1', '1079944340886'],
    ['Ul1qn7gAfwdgVpJaLoeOlbtUKQo2', '1080748775200'],
    ['XkAmyJg8cDdULPEsV0o2tLe93GQ2', '1080369975301'],
    ['ojrqsFfFesXf09uwbxhKXIgBV742', '1080880156076'],
    ['r6b1CJNLl9geE0Pkql1RbJQOQJ33', '1080732080141'],
    ['rzAtah3rf5N5FyJ2JE2cPel8hFv1', '1080714990663'],
    ['lfTLqnqtzmaN3548URi4tZxsOIR2', '1080882654092'],
];

function dedupePairs(pairs) {
    const map = new Map();
    for (const [userId, ampId] of pairs) {
        if (!map.has(userId)) map.set(userId, ampId);
    }
    return Array.from(map.entries()).map(([userId, amplitudeId]) => ({ userId, amplitudeId }));
}

async function main() {
    const startedAt = new Date();
    console.log(`[START] Ban users script | DRY_RUN=${DRY_RUN ? 'YES' : 'NO'}`);

    const targets = dedupePairs(RAW_PAIRS);
    console.log(`[INFO] Unique users to process: ${targets.length}`);

    // Pre-fetch docs with email
    console.log(`[STEP] Fetching user docs…`);
    const details = [];
    for (const t of targets) {
        const ref = db.collection(COLLECTION).doc(t.userId);
        try {
            const snap = await ref.get();
            if (!snap.exists) {
                details.push({ ...t, exists: false });
                console.warn(`[WARN] Missing: users/${t.userId}`);
            } else {
                const data = snap.data() || {};
                const alreadyBanned = data.banned === true;
                details.push({
                    ...t,
                    exists: true,
                    alreadyBanned,
                    email: data.email || '(no email)',
                });
                if (alreadyBanned) {
                    console.log(`[SKIP] Already banned: ${t.userId} | Email=${data.email || 'N/A'}`);
                }
            }
        } catch (err) {
            console.error(`[ERROR] Could not read users/${t.userId}: ${err.message}`);
            details.push({ ...t, exists: null });
        }
    }

    const toUpdate = details.filter(d => d.exists && !d.alreadyBanned);

    if (toUpdate.length === 0) {
        console.log(`[DONE] No updates needed.`);
        process.exit(0);
    }

    if (DRY_RUN) {
        console.log(`[DRY_RUN] Would update:`);
        console.table(toUpdate.map(d => ({
            userId: d.userId,
            email: d.email,
            amplitudeId: d.amplitudeId,
        })));
        process.exit(0);
    }

    console.log(`[STEP] Updating ${toUpdate.length} users…`);
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const slice = toUpdate.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        slice.forEach(d => {
            batch.set(db.collection(COLLECTION).doc(d.userId), { banned: true }, { merge: true });
        });
        try {
            await batch.commit();
            slice.forEach(d => {
                console.log(`[UPDATED] users/${d.userId} | Email=${d.email} | Amplitude=${d.amplitudeId} -> banned=true`);
            });
        } catch (err) {
            console.error(`[ERROR] Batch failed: ${err.message}`);
        }
    }

    console.log(`[DONE] Completed in ${Date.now() - startedAt.getTime()}ms`);
}

main().catch(err => {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
});