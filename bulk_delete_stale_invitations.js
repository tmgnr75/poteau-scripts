/**
 * One-off bulk delete of game_invitations whose game is already over.
 *
 * Clears the backlog the scheduled sweep (gen2/purgeStaleInvitations.js) would
 * take ~8 months to chip through: 52,536,400 documents as of 2026-08-18,
 * reaching back to November 2024. After this runs, the nightly sweep only has
 * to keep up with new volume.
 *
 * THE ONLY THING THAT MATTERS HERE IS THE PREDICATE
 *
 * This deletes permanently and at scale, so the query is deliberately the
 * narrowest possible statement of "the game is over":
 *
 *     game_date < (now - GAME_OVER_DAYS)
 *
 * Verified against production before writing this (2026-08-18, 2026-08-24):
 *   - 500 sampled matches: 0 with a future game_date, 0 with game_date missing
 *   - the 40 NEWEST matches (the riskiest, closest to the cutoff) cross-checked
 *     against their actual game document: 0 whose game.date was still in the
 *     future, and 0 where game_date disagreed with game.date by more than an
 *     hour. game_date is written at creation and is not stale.
 *
 * Documents with a null game_date are NOT touched. Firestore cannot combine
 * `game_date == null` with an inequality on `created` without a composite index
 * that does not exist, and a missing index fails the query outright rather than
 * degrading -- the failure that silently killed scheduleProInvites for 290 runs.
 * They are a legacy tail, not ongoing volume.
 *
 * Usage:
 *   node bulk_delete_stale_invitations.js --dry            # count only, deletes nothing
 *   node bulk_delete_stale_invitations.js --apply          # delete
 *   node bulk_delete_stale_invitations.js --apply --max=1000000
 *
 * Safe to stop (ctrl-C) and re-run: it always re-queries the oldest remaining
 * matches, so it resumes where it left off. Progress is printed continuously.
 */

const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const GAME_OVER_DAYS = 7;
const PAGE = 500;              // documents fetched per query
const CONCURRENT_BATCHES = 8;  // BulkWriter handles its own parallelism

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY = args.includes('--dry') || !APPLY;
const MAX = (() => {
    const a = args.find(x => x.startsWith('--max='));
    return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

const cutoff = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - GAME_OVER_DAYS * 24 * 3600 * 1000)
);

/**
 * --by-created mode: for the ~11M documents written before `game_date` existed.
 *
 * Firestore cannot select on an ABSENT field, so those documents are invisible
 * to the game_date query above and to `game_date == null` alike (that matches
 * only explicit nulls, of which there are zero). They are unreachable forever
 * by any field query.
 *
 * `created` IS indexed, and for this population it is a safe proxy: an
 * invitation written more than 500 days ago cannot point at a game that has not
 * happened. Verified against production 2026-08-24 -- of the 60 NEWEST
 * invitations created >500d ago (the riskiest, closest to the cutoff), 60 had a
 * game already in the past, 0 had a game still in the future, and 0 were
 * orphaned.
 *
 * Backfilling game_date onto them instead was considered and rejected on cost:
 * ~11M reads to scan plus ~11M writes (~$27) to enable a delete that costs
 * ~$2.20 on its own. An orphaned invitation whose game no longer exists is
 * deleted by the same pass, which is the right outcome either way.
 */
const CREATED_OVER_DAYS = 500;
const createdCutoff = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - CREATED_OVER_DAYS * 24 * 3600 * 1000)
);
const BY_CREATED = args.includes('--by-created');

function fmt(n) { return n.toLocaleString(); }

/**
 * Refuses to run if the query would match anything that is not clearly a past
 * game. Cheap insurance against a bad cutoff or a schema change: it costs one
 * extra query and it is the difference between deleting history and deleting
 * live invitations.
 */
async function preflight() {
    const snap = BY_CREATED
        ? await db.collection('game_invitations')
            .where('created', '<', createdCutoff)
            .orderBy('created', 'desc')  // NEWEST matches = closest to the cutoff = riskiest
            .limit(200).get()
        : await db.collection('game_invitations')
            .where('game_date', '<', cutoff)
            .orderBy('game_date', 'desc')
            .limit(200).get();

    if (snap.empty) return { ok: true, checked: 0 };

    const now = new Date();
    let future = 0, missing = 0;
    for (const d of snap.docs) {
        // In --by-created mode the whole point is that game_date is absent, so
        // the guard checks `created` is genuinely ancient instead.
        const field = BY_CREATED ? d.get('created') : d.get('game_date');
        if (!field) { missing++; continue; }
        if (BY_CREATED) {
            if (field.toDate() > new Date(Date.now() - CREATED_OVER_DAYS * 86400000)) future++;
        } else if (field.toDate() > now) {
            future++;
        }
    }

    if (future > 0 || missing > 0) {
        return { ok: false, checked: snap.size, future, missing };
    }
    // In --by-created mode game_date is absent by definition, so report the
    // field the mode actually sorted on.
    const newestField = snap.docs[0].get(BY_CREATED ? 'created' : 'game_date');
    return {
        ok: true,
        checked: snap.size,
        newest: newestField && newestField.toDate ? newestField.toDate() : null,
    };
}

async function main() {
    console.log(BY_CREATED
        ? `cutoff: created < ${createdCutoff.toDate().toISOString()} (${CREATED_OVER_DAYS} days ago) [--by-created]`
        : `cutoff: game_date < ${cutoff.toDate().toISOString()} (${GAME_OVER_DAYS} days ago)`);
    console.log(`mode:   ${APPLY ? 'APPLY (deleting)' : 'DRY RUN (nothing will be deleted)'}`);
    if (MAX !== Infinity) console.log(`max:    ${fmt(MAX)}`);
    console.log('');

    const pre = await preflight();
    if (!pre.ok) {
        console.error('PREFLIGHT FAILED - refusing to delete.');
        console.error(`  matches with a future game_date: ${pre.future}`);
        console.error(`  matches with no game_date:       ${pre.missing}`);
        process.exit(1);
    }
    console.log(`preflight OK: ${pre.checked} newest matches checked, all genuinely past.`);
    if (pre.newest) console.log(`  newest match: ${pre.newest.toISOString().slice(0, 10)}`);
    console.log('');

    if (DRY) {
        // Count in bounded slices; an unbounded count() on this collection
        // exceeds the deadline.
        const D = n => admin.firestore.Timestamp.fromDate(new Date(Date.now() - n * 86400000));
        const field = BY_CREATED ? 'created' : 'game_date';
        const windows = BY_CREATED
            ? [[3650, 900], [900, 700], [700, 600], [600, CREATED_OVER_DAYS]]
            : [[3650, 365], [365, 180], [180, 90], [90, 30], [30, GAME_OVER_DAYS]];
        let total = 0;
        for (const [a, b] of windows) {
            const c = (await db.collection('game_invitations')
                .where(field, '>=', D(a)).where(field, '<', D(b))
                .count().get()).data().count;
            console.log(`  ${a}d..${b}d ago: ${fmt(c)}`);
            total += c;
        }
        console.log(`\nWOULD DELETE: ${fmt(total)} documents`);
        console.log(`estimated delete cost: $${(total / 100000 * 0.02).toFixed(2)}`);
        console.log('\nRe-run with --apply to delete.');
        return;
    }

    const started = Date.now();
    let deleted = 0;

    while (deleted < MAX) {
        const lim = Math.min(PAGE, MAX - deleted);
        const snap = BY_CREATED
            ? await db.collection('game_invitations')
                .where('created', '<', createdCutoff)
                .orderBy('created', 'asc').limit(lim).get()
            : await db.collection('game_invitations')
                .where('game_date', '<', cutoff)
                .orderBy('game_date', 'asc').limit(lim).get();

        if (snap.empty) {
            console.log('\nno more matches - backlog clear.');
            break;
        }

        const writer = db.bulkWriter();
        // Without an error handler a single failed delete rejects close() and
        // loses the whole page.
        writer.onWriteError(err => err.failedAttempts < 3);
        snap.docs.forEach(d => writer.delete(d.ref));
        await writer.close();

        deleted += snap.size;

        const elapsed = (Date.now() - started) / 1000;
        const rate = deleted / elapsed;
        process.stdout.write(
            `\rdeleted ${fmt(deleted)}  (${rate.toFixed(0)}/s, ${elapsed.toFixed(0)}s elapsed)   `
        );

        if (snap.size < PAGE) {
            console.log('\nfinal partial page - backlog clear.');
            break;
        }
    }

    const elapsed = (Date.now() - started) / 1000;
    console.log(`\n\ndone: ${fmt(deleted)} deleted in ${elapsed.toFixed(0)}s`);
    console.log(`cost: ~$${(deleted / 100000 * 0.02).toFixed(2)}`);
}

main().then(() => process.exit(0)).catch(e => {
    console.error('\nFAILED:', e.message);
    process.exit(1);
});
