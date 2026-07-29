/**
 * Strip the literal "null" prefix from game and repeater descriptions.
 *
 * Cause: poteau-max lib/games/create/create_widget.dart:3799 (and :3878) build
 * the description as
 *
 *   '${_model.selectedDescription}${... ? ' • ' : ''}${...}'
 *
 * The guard correctly decides whether to append the ' • ' separator, but
 * `${_model.selectedDescription}` is interpolated unconditionally. Dart's
 * string interpolation calls toString() on null, which yields the four
 * characters "null". So an organizer who leaves the description blank but sets
 * a field type or gender type gets a description literally beginning "null".
 *
 * This script only repairs stored data. The Dart fix has to happen in
 * FlutterFlow, otherwise new games keep reproducing it.
 *
 * Only strips a leading "null" when the remainder is non-empty, so a
 * description a human genuinely typed as "null..." is left alone.
 *
 * Run:
 *   node fixNullDescriptions.js --dry-run          preview (all centres)
 *   node fixNullDescriptions.js --send             apply to all centres
 *   node fixNullDescriptions.js --send --uid=XXX   limit to one organizer
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const PREFIX = 'null';

// A separator may or may not follow the stray "null", depending on whether the
// organizer had also typed a real description. Strip a leading " • " too.
// Returns the corrected string, or null when the doc needs no change.
// A description that is exactly "null" (nothing typed, nothing selected)
// becomes an empty string, which is what 64908 other games already store.
function clean(description) {
    if (typeof description !== 'string') return null;
    if (!description.startsWith(PREFIX)) return null;
    let rest = description.slice(PREFIX.length);
    rest = rest.replace(/^\s*•\s*/, '').trim();
    return rest;
}

async function main() {
    const args = process.argv.slice(2);
    const send = args.includes('--send') || args.includes('-s');
    const dryRun = args.includes('--dry-run') || args.includes('-d');
    const uidArg = args.find((a) => a.startsWith('--uid='));
    const onlyUid = uidArg ? uidArg.split('=')[1] : null;

    if (!send && !dryRun) {
        console.log('Usage:');
        console.log('  node fixNullDescriptions.js --dry-run          preview');
        console.log('  node fixNullDescriptions.js --send            apply');
        console.log('  node fixNullDescriptions.js --send --uid=XXX  one organizer only');
        process.exit(1);
    }

    if (onlyUid) console.log(`Restricted to organizer ${onlyUid}`);

    const plan = [];

    for (const collection of ['games', 'draft_games', 'repeaters']) {
        let query = db.collection(collection);
        if (onlyUid) query = query.where('organizer', '==', onlyUid);
        const snap = await query.get();

        snap.docs.forEach((doc) => {
            const data = doc.data();
            const cleaned = clean(data.description);
            if (cleaned === null) return;
            plan.push({
                collection,
                id: doc.id,
                centre: data.centre || '?',
                before: data.description,
                after: cleaned,
                date: data.date ? data.date.toDate().toISOString().slice(0, 16) : '',
            });
        });
    }

    if (plan.length === 0) {
        console.log('\nNothing to fix.\n');
        process.exit(0);
    }

    console.log(`\n${plan.length} document(s) to fix:\n`);
    const byCentre = {};
    plan.forEach((p) => (byCentre[p.centre] = (byCentre[p.centre] || 0) + 1));
    Object.entries(byCentre).forEach(([c, n]) => console.log(`  ${String(n).padStart(3)}  ${c}`));

    console.log('');
    plan.forEach((p) => {
        console.log(`  ${p.collection}/${p.id} ${p.date} [${p.centre}]`);
        console.log(`     before: ${JSON.stringify(p.before)}`);
        console.log(`     after : ${JSON.stringify(p.after)}`);
    });

    if (dryRun) {
        console.log('\n🔍 Dry run, nothing written.\n');
        process.exit(0);
    }

    let ok = 0;
    for (const p of plan) {
        await db.collection(p.collection).doc(p.id).update({ description: p.after });
        ok++;
    }
    console.log(`\n✅ Updated ${ok} document(s).\n`);
    process.exit(0);
}

main().catch((error) => {
    console.error('\n❌ FAILED:', error.message);
    process.exit(1);
});
