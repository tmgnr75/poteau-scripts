/**
 * Ban users matching email pattern: ^salah\d+@gmail\.com$
 * Usage:
 *   node banSalahPattern.js
 *   DRY_RUN=1 node banSalahPattern.js
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
const PATTERN = /^salah\d+@gmail\.com$/i;

async function main() {
    const t0 = Date.now();
    console.log(`[START] Ban by email pattern ^salah\\d+@gmail\\.com$ | DRY_RUN=${DRY_RUN ? 'YES' : 'NO'}`);

    console.log(`[STEP] Querying users where email starts with "salah"…`);
    const snap = await db.collection(COLLECTION)
        .where('email', '>=', 'salah')
        .where('email', '<', 'salah' + '\uf8ff')
        .get();

    console.log(`[INFO] Candidates fetched: ${snap.size}`);

    const candidates = [];
    snap.forEach(doc => {
        const data = doc.data() || {};
        const email = (data.email || '').trim();
        const banned = data.banned === true;
        if (PATTERN.test(email)) {
            candidates.push({ userId: doc.id, email, banned });
        }
    });

    if (candidates.length === 0) {
        console.log(`[DONE] No users matching exact pattern. Time=${Date.now() - t0}ms`);
        return;
    }

    console.log(`[RESULTS] Exact matches: ${candidates.length}`);
    console.table(candidates);

    const toBan = candidates.filter(c => !c.banned);
    console.log(`[SUMMARY] Not yet banned: ${toBan.length}`);

    if (toBan.length === 0) {
        console.log(`[DONE] Everyone matching pattern is already banned. Time=${Date.now() - t0}ms`);
        return;
    }

    if (DRY_RUN) {
        console.log(`[DRY_RUN] Would set banned=true for:`);
        console.table(toBan);
        console.log(`[DONE][DRY_RUN] Time=${Date.now() - t0}ms`);
        return;
    }

    console.log(`[STEP] Writing updates in batches of ${BATCH_SIZE}…`);
    let updatedCount = 0;
    for (let i = 0; i < toBan.length; i += BATCH_SIZE) {
        const slice = toBan.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        slice.forEach(d => {
            batch.set(db.collection(COLLECTION).doc(d.userId), { banned: true }, { merge: true });
        });
        try {
            await batch.commit();
            slice.forEach(d => {
                console.log(`[UPDATED] users/${d.userId} | Email=${d.email} -> banned=true`);
            });
            updatedCount += slice.length;
        } catch (err) {
            console.error(`[BATCH ERROR] Failed [${i + 1}..${i + slice.length}] — ${err.message}`);
            // Fallback per-doc for visibility
            for (const d of slice) {
                try {
                    await db.collection(COLLECTION).doc(d.userId).set({ banned: true }, { merge: true });
                    console.log(`[FALLBACK OK] users/${d.userId} | Email=${d.email} -> banned=true`);
                    updatedCount += 1;
                } catch (e2) {
                    console.error(`[FALLBACK ERROR] users/${d.userId} | Email=${d.email} — ${e2.message}`);
                }
            }
        }
    }

    // Verify
    console.log(`[STEP] Verifying…`);
    const verifyFailures = [];
    for (const d of toBan) {
        try {
            const snap2 = await db.collection(COLLECTION).doc(d.userId).get();
            const ok = snap2.exists && snap2.data() && snap2.data().banned === true;
            if (!ok) {
                console.error(`[VERIFY FAIL] users/${d.userId} | Email=${d.email} — banned not confirmed`);
                verifyFailures.push(d.userId);
            }
        } catch (e) {
            console.error(`[VERIFY ERROR] users/${d.userId} | Email=${d.email} — ${e.message}`);
            verifyFailures.push(d.userId);
        }
    }

    console.log('='.repeat(72));
    console.log(`[FINAL SUMMARY]`);
    console.log(`- Exact matches: ${candidates.length}`);
    console.log(`- Already banned: ${candidates.filter(c => c.banned).length}`);
    console.log(`- Newly banned: ${updatedCount}`);
    console.log(`- Verify failures: ${verifyFailures.length}`);
    if (verifyFailures.length) console.log(verifyFailures.join(', '));
    console.log(`- Duration: ${Date.now() - t0}ms`);
    console.log('='.repeat(72));

    console.log(`[DONE] Completed.`);
}

main().catch(err => {
    console.error(`[FATAL] ${err.stack || err.message}`);
    process.exit(1);
});