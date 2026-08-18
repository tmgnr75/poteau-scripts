const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// DRY_RUN unless EXECUTE=1
const DRY_RUN = process.env.EXECUTE !== '1';

// Foot POWER 5 pro account (organizer on the 05-08 games) — used as the reporting ref.
const FP5_REF = db.doc('users/sss3dYi6nzWd7rEjwcQ30LGKudj1');

// Append 3 occurrences of the FP5 ref to each player's existing no_show_reports.
// We push the ref 3x via read-modify-write (NOT arrayUnion, which would dedupe to 1).
const ADD = 3;
const TARGETS = {
    sVaBM5QOhtNMAxWYSXKGm9H0Arf2: 'Kassim',
    TBi7xlZkIgcTwhoT3JXmuO6xuMS2: 'Fawzi Fawzi',
    q0R7EVydkUhwJLqncbal7g7Vcp13: 'Anis Tabu',
};

async function main() {
    console.log(DRY_RUN ? '======= DRY RUN (no writes) =======\n' : '======= EXECUTING (writing changes) =======\n');
    for (const [uid, name] of Object.entries(TARGETS)) {
        const ref = db.collection('users').doc(uid);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`!! ${name} (${uid}) MISSING`); continue; }
        const before = (snap.data().no_show_reports || []);
        const after = [...before, ...Array(ADD).fill(FP5_REF)];
        console.log(`${name} (${uid}): ${before.length} -> ${after.length} no_show_reports (+${ADD} FP5 refs)`);
        if (!DRY_RUN) {
            await ref.update({ no_show_reports: after });
            console.log(`   written.`);
        }
    }
    console.log(DRY_RUN ? '\nDRY RUN complete. Re-run with EXECUTE=1 to write.' : '\nDone.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
