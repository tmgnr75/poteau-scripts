/**
 * Poteau | One-off: ban the account linked to banned no-show offender Adil (Wellie Dufeignies).
 * Mehdi Moumen shares Adil's exact phone number (+33620179223) and has 0 games played.
 * Banned as a ban-evasion / duplicate vector following the 2026-07-09 no-show incident
 * (Danny Fonseca complaint: Adil left without paying his on-site share).
 * Usage: DRY_RUN=1 node ban_adil_linked_mehdi.js  |  node ban_adil_linked_mehdi.js
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const DRY_RUN = !!process.env.DRY_RUN;
const TARGETS = [
    { uid: 'WbM8LRz0oXcbaGv0r4VMIv9j8Kn2', note: 'Mehdi Moumen — same phone as banned Adil' },
];

async function main() {
    console.log(`[START] DRY_RUN=${DRY_RUN ? 'YES' : 'NO'}`);
    for (const t of TARGETS) {
        const ref = db.collection('users').doc(t.uid);
        const snap = await ref.get();
        if (!snap.exists) { console.warn(`[WARN] Missing users/${t.uid}`); continue; }
        const d = snap.data();
        console.log(`[TARGET] ${t.uid} | ${d.display_name} | phone=${d.phone_number} | banned=${d.banned} | ${t.note}`);
        if (d.banned === true) { console.log('[SKIP] already banned'); continue; }
        if (DRY_RUN) { console.log('[DRY_RUN] would set banned=true'); continue; }
        await ref.set({ banned: true }, { merge: true });
        console.log(`[UPDATED] users/${t.uid} -> banned=true`);
    }
    console.log('[DONE]');
    process.exit(0);
}
main().catch(e => { console.error('[FATAL]', e.message); process.exit(1); });
