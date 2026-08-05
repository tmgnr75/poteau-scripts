/**
 * Backfill `users/{uid}/discipline_cards` from the legacy `discipline.*` fields.
 *
 * WHY: cards used to be recorded as a running total plus the LAST card's coarse
 * shape (cards / last_card_at / last_reason / last_source). Each new card
 * overwrote the previous one's reason and source, so only one card per user is
 * recoverable. The profile lists cards, so every card needs its own document --
 * `shared/cards.js` now writes one per card. Users carded BEFORE that change
 * have no subcollection at all and would render an empty history next to a
 * non-zero counter.
 *
 * This writes ONE synthetic doc per carded user, reconstructed from the four
 * fields. It cannot recover more than that: if a user has two cards, the first
 * one's reason, source and game are genuinely gone.
 *
 * WHAT IS AND ISN'T RECOVERABLE
 *
 *   colour       cards >= 2 ? red : yellow      reliable
 *   issued_at    discipline.last_card_at        reliable (the LAST card's date)
 *   source       discipline.last_source         reliable
 *   reason       discipline.last_reason         reliable
 *   card_number  discipline.cards               reliable
 *   game         null                           NEVER persisted, unrecoverable
 *   direct_red   inferred, see below            reliable for the 1-card case
 *
 * `direct_red` is inferable in the one case that matters: a user sitting on a
 * SINGLE card who is nonetheless banned can only have got there through a
 * moderator's red button, because the ladder does not ban until two. With two
 * or more cards it is genuinely unknowable and stays false.
 *
 * Every doc carries `backfilled: true`. A backfilled card does not know its
 * game, and the profile should say "details not recorded" rather than imply the
 * card had no game -- those are different claims.
 *
 * Idempotent: skips any user who already has a discipline_cards doc, so it is
 * safe to re-run and safe to run after real cards have started landing.
 *
 *   node scripts/backfill_discipline_cards.js --dry-run
 *   node scripts/backfill_discipline_cards.js
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');
const RED_CARD_AT = 2;

(async () => {
    console.log(DRY_RUN ? '=== DRY RUN (no writes) ===' : '=== LIVE RUN ===');

    // Small population by design: this is the whole carded history of the
    // platform, not a paged scan. If it ever grows past a few hundred, page it.
    const snap = await db.collection('users').where('discipline.cards', '>', 0).get();
    console.log(`Carded users: ${snap.size}\n`);

    let written = 0, skipped = 0, malformed = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const d = data.discipline || {};
        const cards = d.cards || 0;

        // Already has history: either real cards written by cards.js, or a
        // previous run of this script.
        const existing = await doc.ref.collection('discipline_cards').limit(1).get();
        if (!existing.empty) {
            console.log(`SKIP  ${doc.id} (${data.display_name || '?'}) - already has history`);
            skipped++;
            continue;
        }

        // last_card_at is the only timestamp we have. Without it the doc would
        // have no position in the history and could not be ordered or removed.
        if (!d.last_card_at) {
            console.log(`SKIP  ${doc.id} (${data.display_name || '?'}) - no last_card_at, cannot place it in time`);
            malformed++;
            continue;
        }

        const isRed = cards >= RED_CARD_AT;
        // Banned on a single card => a moderator's red button. The ladder only
        // bans at two, so nothing else could have produced this state.
        const directRed = cards === 1 && data.banned === true;

        const payload = {
            colour: (isRed || directRed) ? 'red' : 'yellow',
            issued_at: d.last_card_at,
            source: d.last_source || 'moderator',
            reason: d.last_reason || d.last_source || 'unknown',
            game: null,
            game_date: null,
            game_centre: null,
            sport: null,
            direct_red: directRed,
            card_number: cards,
            issued_by: null,
            report: null,
            removed_at: null,
            removed_by: null,
            // Lets the client soften its wording: this card genuinely does not
            // know its game, rather than having happened without one.
            backfilled: true,
        };

        console.log(
            `WRITE ${doc.id} (${data.display_name || '?'}) - ${payload.colour}` +
            `${directRed ? ' (direct red, inferred from banned+1 card)' : ''}` +
            ` reason=${payload.reason} #${payload.card_number}`
        );

        if (!DRY_RUN) {
            await doc.ref.collection('discipline_cards').add(payload);
        }
        written++;
    }

    console.log(`\nWritten: ${written} | Skipped (had history): ${skipped} | Skipped (malformed): ${malformed}`);
    if (DRY_RUN) console.log('Dry run: nothing was written.');
    process.exit(0);
})().catch((err) => {
    console.error('FAILED:', err);
    process.exit(1);
});
