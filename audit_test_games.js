/**
 * Find fixtures that escaped the seeding rules. Run it after any seeding
 * session, and before trusting any number on a profile.
 *
 * WHY THIS EXISTS. On 2026-08-27 Tim's profile said 15 played games. The truth
 * was 1. Twenty-two seeded games at the test venue carried no `is_test_game`
 * flag, and one fixture had been placed at a REAL Paris venue on purpose, to
 * test how an 81-character name wraps on a card.
 *
 * Both classes are invisible to every existing guard:
 *
 *   - an UNFLAGGED fixture is skipped by the purge, which selects on the flag,
 *     so it is not merely wrong -- it is permanent
 *   - a FLAGGED fixture at a real venue is purgeable but sits on a pitch that
 *     exists, which is how a real player joined a seeded game in 35 minutes on
 *     2026-08-17
 *
 * Exits non-zero when anything is found, so it can gate a session.
 *
 * Usage:
 *   node audit_test_games.js            # report
 *   node audit_test_games.js --fix      # flag unflagged games at the test venue
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
const { auditTestGames, TEST_VENUE } = require("./lib/test_game");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
});
const db = admin.firestore();
const FIX = process.argv.includes("--fix");

(async () => {
    const { unflaggedAtVenue, flaggedOffVenue } = await auditTestGames(db);

    console.log(`test venue: ${TEST_VENUE.centre}\n`);

    if (!unflaggedAtVenue.length && !flaggedOffVenue.length) {
        console.log("clean: every fixture is flagged, and every flagged game is at the test venue.");
        process.exit(0);
    }

    if (unflaggedAtVenue.length) {
        console.log(
            `UNFLAGGED at the test venue: ${unflaggedAtVenue.length}\n` +
            `  These count on profiles and in users.stats, and the purge cannot see them.`
        );
        unflaggedAtVenue.slice(0, 20).forEach((id) => console.log(`    ${id}`));
        if (unflaggedAtVenue.length > 20) {
            console.log(`    ... and ${unflaggedAtVenue.length - 20} more`);
        }
    }

    if (flaggedOffVenue.length) {
        // NOT AUTOMATICALLY A PROBLEM, and never auto-fixed.
        //
        // Checked 2026-08-27: the five here are old fixtures (Sept 2025) at
        // real venues, correctly flagged, with rosters that are test accounts
        // missing the `is_test_account` field. Harmless.
        //
        // But the same shape would also be produced by a REAL game flagged by
        // mistake, and unflagging that would erase somebody's history. So this
        // reports and stops: whether a given game is a fixture is a judgement
        // about its roster, not something a script should decide.
        console.log(
            `\nFLAGGED but NOT at the test venue: ${flaggedOffVenue.length}\n` +
            `  Check each roster before assuming. A fixture on a real pitch is a\n` +
            `  risk; a real game wrongly flagged is somebody's history erased.\n` +
            `  Never auto-fixed.`
        );
        flaggedOffVenue.slice(0, 20).forEach((g) =>
            console.log(`    ${g.id}  ${g.centre}`));
    }

    if (FIX && unflaggedAtVenue.length) {
        // Only the flag, and only at the test venue. Moving a game OFF a real
        // venue is not something a script should decide -- the roster may hold
        // someone real, and that is a judgement call.
        const b = db.batch();
        unflaggedAtVenue.forEach((id) =>
            b.update(db.collection("games").doc(id), { is_test_game: true }));
        await b.commit();
        console.log(`\nflagged ${unflaggedAtVenue.length} game(s).`);
        console.log("Now recompute the affected users, or their stats stay wrong:");
        console.log("  their profiles will not correct themselves.");
    } else if (unflaggedAtVenue.length) {
        console.log("\nre-run with --fix to flag them.");
    }

    // Only the unflagged class is a failure. The off-venue list is a prompt to
    // look, and gating a session on it would train people to ignore the gate.
    process.exit(unflaggedAtVenue.length ? 1 : 0);
})();
