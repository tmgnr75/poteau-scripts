/**
 * Repair greetings on the off-peak nudge messages sent 2026-07-29.
 *
 * Three messages used the stored `centre_user_first_name` verbatim, which
 * reads as machine-generated rather than written by a person:
 *
 *   - "Salut JORDAN"   -> all caps. Prior conversations (2024) all say "Jordan".
 *   - "Salut gockan"   -> all lowercase. Prior conversations address this
 *                         centre as "Damia", never "gockan", and the centre
 *                         replied without correcting it, so Damia is the name
 *                         actually in use.
 *   - "Salut l'équipe Campus Sport dans la Ville  Pantin" -> double space,
 *                         copied from the stored centre_name. Also unwieldy;
 *                         shortened to the name people actually use.
 *
 * Only the greeting line is rewritten. The body (numbers, slots) is untouched.
 *
 * Run:
 *   node fixNudgeGreetings.js --dry-run
 *   node fixNudgeGreetings.js --send
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const FIXES = [
    {
        doc: '24Q7WnrpKFKEjwjrlehy',
        centre: 'LE FIVE OL',
        from: 'Salut JORDAN,',
        to: 'Salut Jordan,',
    },
    {
        doc: 'XZrdTfP9JSdhOPTyTsnX',
        centre: 'Footbox',
        from: 'Salut gockan,',
        to: 'Salut Damia,',
    },
    {
        doc: 'UNf22jVoOrbG5myJp8He',
        centre: 'Campus Sport dans la Ville Pantin',
        from: "Salut l'équipe Campus Sport dans la Ville  Pantin,",
        to: "Salut l'équipe Sport dans la Ville,",
    },
];

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send');
    const dryRun = args.includes('--dry-run');
    if (!send && !dryRun) {
        console.log('Usage: node fixNudgeGreetings.js --dry-run | --send');
        process.exit(1);
    }

    for (const f of FIXES) {
        const ref = db.collection('messenger').doc(f.doc);
        const snap = await ref.get();
        if (!snap.exists) {
            console.log(`MISSING messenger/${f.doc} (${f.centre})`);
            continue;
        }
        const text = snap.get('text');
        if (!text.startsWith(f.from)) {
            console.log(`SKIP ${f.centre}: opening line is not "${f.from}"`);
            console.log(`     actual: ${JSON.stringify(text.split('\n')[0])}`);
            continue;
        }

        const updated = f.to + text.slice(f.from.length);
        console.log(`${f.centre}`);
        console.log(`   before: ${JSON.stringify(text.split('\n')[0])}`);
        console.log(`   after : ${JSON.stringify(updated.split('\n')[0])}`);

        if (send) {
            await ref.update({ text: updated });
            console.log('   updated.');
        }
    }

    console.log(send ? '\nDone.' : '\nDry run, nothing written.');
    process.exit(0);
}

main().catch((e) => {
    console.error('FAILED:', e.message);
    process.exit(1);
});
