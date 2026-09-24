/**
 * THE ONE PLACE THAT DECIDES WHAT A TEST GAME IS.
 *
 * Every seeder must build its game documents through `testGame()` and purge
 * through `purgeTestGames()`. The rules below are then structural rather than
 * remembered, which is the whole point: there are eleven seeders in this
 * directory and the guards used to live in one of them.
 *
 * ---------------------------------------------------------------------------
 * WHAT WENT WRONG (2026-08-27)
 * ---------------------------------------------------------------------------
 *
 * 22 seeded games at the test venue carried no `is_test_game` flag, plus a
 * fixture deliberately placed at a REAL Paris venue to test a long name on a
 * card. Consequences, all of them real:
 *
 *   - They counted on Tim's profile. It read 15 played; the truth was 1.
 *   - They counted in `users.stats`, so every derived number was wrong.
 *   - They were UNPURGEABLE. The purge selects on `is_test_game`, so an
 *     unflagged fixture is invisible to the very cleanup meant to remove it
 *     and lives forever.
 *
 * The flag is not a label. It is the cleanup key, and a fixture written
 * without one is permanent litter in a production database.
 *
 * ---------------------------------------------------------------------------
 * THE FOUR RULES, ASSERTED NOT DOCUMENTED
 * ---------------------------------------------------------------------------
 *
 *   1. `is_test_game: true`   -- excluded from stats and profiles, and
 *                                purgeable. Cannot be overridden.
 *   2. `visibility: private`  -- cannot enter anybody's feed.
 *   3. at the TEST VENUE      -- VSD39 Dole, in the Jura, never a real pitch
 *                                somebody might actually be standing on.
 *   4. test accounts only     -- caller asserts; `assertTestRoster` checks.
 *
 * Rule 3 is the one that was quietly broken, and it is worth being blunt about
 * why it matters beyond tidiness: on 2026-08-17 a sibling seeder wrote PUBLIC
 * games to LE FIVE Paris 17 and within 35 minutes a real player had joined
 * one. Deleting the seed then deleted a game a person had signed up for.
 *
 * A CARD LAYOUT TEST DOES NOT NEED A REAL VENUE. The 81-character name was
 * seeded at "Complexe Sportif Intercommunal Marcel Cerdan de Saint-Ouen-sur-
 * Seine Nord" purely to exercise the width. `longTestVenue()` gives the same
 * character count at the test venue instead.
 */

/** The default venue a fixture sits at. */
const TEST_VENUE = {
    centre: "VSD39 Dole",
    placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    lat: 47.0926,
    lng: 5.4906,
};

/**
 * THE REMOTE VENUE — the second sanctioned venue, and the only other one.
 *
 * Added 2026-09-24 for the store-screenshot seeder, after a capture proved the
 * problem Dole cannot solve. Dole is safe because nobody browses there, but
 * "nobody browses" is not "nobody is nearby": the screenshot VIEWER has to
 * stand somewhere, and a viewer standing in Paris sees Paris. The games list
 * came back full of LE FIVE Bezons, Créteil, Marville and Colombes -- real
 * venues, real users' games, real spot counts -- because getGamesMulti
 * searches by radius and does not filter on is_test_game.
 *
 * A store listing must not show a real person's game. Moving the viewer alone
 * does not fix it either: put the viewer in Kinshasa and the fixtures stay in
 * the Jura, 6,000km away, so the list is empty instead of wrong.
 *
 * A remote point is the answer because a radius search from it finds the
 * seeded games and nothing else, there being nothing else within 939km. The
 * seeder asserts that distance at run time rather than trusting this comment.
 *
 * This is an ALLOWLIST, not a removed check. A fixture may sit at Dole or at
 * Kinshasa; anywhere else still throws. The rule that matters -- never a real
 * pitch somebody might be standing on -- is intact, and both of these are
 * places where that cannot happen.
 */
const REMOTE_VENUE = {
    centre: "Poteau Test Ground",
    placeId: "test_remote_store_shots",
    // Near Kisangani, DRC. Measured 2026-09-24 against all 106,373 located
    // accounts: the NEAREST real user is 939km away. Kinshasa itself was the
    // obvious pick and was rejected on measurement -- one real account sits
    // 19km from it, dormant for 1,100 days but still a person who could
    // reopen the app. 939km leaves no judgement call to make.
    lat: 0.5153,
    lng: 25.1911,
};

/** Every venue a fixture may sit at. Nothing else is permitted. */
const SANCTIONED_VENUES = [TEST_VENUE, REMOTE_VENUE];

/**
 * A venue name as long as the longest real one, still at the test venue.
 *
 * Production holds an 81-character venue name, and a card has to survive it.
 * Padding the test venue reproduces the layout problem exactly without putting
 * a fixture on a pitch that exists.
 */
function longTestVenue(chars = 81) {
    const suffix = " — terrain d'essai, ne pas utiliser en production";
    let name = `${TEST_VENUE.centre}${suffix}`;
    while (name.length < chars) name += "x";
    return name.slice(0, chars);
}

/**
 * Build a game document that cannot violate the rules.
 *
 * The four guarantees are applied AFTER the caller's fields, so a seeder
 * cannot set `is_test_game: false` or point a fixture at a real venue even by
 * accident. Everything else is the caller's business.
 *
 * @param {object} fields the seeder's own game fields
 * @param {object} [opts]
 * @param {number} [opts.venueNameLength] use a padded venue name this long
 * @returns {object} the document to write
 */
function testGame(fields = {}, opts = {}) {
    // `opts.venue` selects a SANCTIONED venue, and nothing else is accepted.
    // Passing an object of your own throws rather than being honoured, so this
    // stays an allowlist: the caller chooses between vetted places, it does
    // not supply a new one.
    const venue = opts.venue || TEST_VENUE;
    if (!SANCTIONED_VENUES.includes(venue)) {
        throw new Error(
            "[test_game] REFUSING TO SEED: opts.venue must be one of the " +
            "sanctioned venues exported by this module (TEST_VENUE, " +
            "REMOTE_VENUE). A fixture may never sit at an arbitrary place."
        );
    }

    const centre = opts.venueNameLength
        ? longTestVenue(opts.venueNameLength)
        : venue.centre;

    // `opts.public` is permitted ONLY at a venue that has been measured clear
    // of real users, which today means the remote venue and never Dole.
    //
    // WHY IT EXISTS (2026-09-24). A private game renders a PADLOCK on its card
    // (game_list_widget.dart ~l.758), unconditionally -- the friendship
    // exemption only clears the 0.5 opacity, not the lock. So a private
    // fixture cannot produce a clean store screenshot, no matter how the
    // viewer is related to the organizer.
    //
    // Making it public is safe here for a reason that does NOT apply at Dole:
    // discovery is geographic, and the remote venue has no real user within
    // 939km. `visibility: private` was never the thing keeping strangers out
    // anyway -- getGamesMulti does not filter on it, and the dimming is
    // client-side. DISTANCE is the actual barrier, and it is asserted by the
    // seeder before every write.
    if (opts.public && venue === TEST_VENUE) {
        throw new Error(
            "[test_game] REFUSING TO SEED: a public fixture at the default " +
            "venue. Public is permitted only at a venue measured clear of " +
            "real users."
        );
    }

    return {
        ...fields,
        // Applied last on purpose: these are not negotiable, and a
        // spread-first caller must not be able to win an argument with them.
        is_test_game: true,
        visibility: opts.public ? "public" : "private",
        centre,
        address: centre,
        place_id: venue.placeId,
    };
}

/**
 * Throw unless every uid on the roster is a test account.
 *
 * Takes the uids rather than reading them, so a seeder that builds rosters its
 * own way still gets checked. Deduped by the caller or not -- a `+1` repeats a
 * uid and that is fine here.
 *
 * @param {Array<string>} uids
 * @param {Set<string>|Array<string>} testAccountIds
 */
function assertTestRoster(uids, testAccountIds) {
    const allowed = testAccountIds instanceof Set
        ? testAccountIds
        : new Set(testAccountIds);
    const strangers = [...new Set(uids)].filter((u) => !allowed.has(u));
    if (strangers.length) {
        throw new Error(
            `[test_game] REFUSING TO SEED: ${strangers.length} non-test ` +
            `account(s) on a fixture roster: ${strangers.join(", ")}`
        );
    }
}

/**
 * Verify what was actually written, not what was planned.
 *
 * Asserting the plan and asserting the data are different things, and only the
 * second one would have caught the 22 orphans. Re-reads every game this run
 * created and throws if any rule is broken.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Array<FirebaseFirestore.DocumentReference>} refs
 */
async function verifyWritten(db, refs) {
    const problems = [];
    for (const ref of refs) {
        const snap = await ref.get();
        if (!snap.exists) { problems.push(`${ref.id}: missing`); continue; }
        const g = snap.data();
        if (g.is_test_game !== true) problems.push(`${ref.id}: not flagged`);
        if (!["private", "public"].includes(g.visibility)) {
            problems.push(`${ref.id}: visibility=${g.visibility}`);
        }
        if (!SANCTIONED_VENUES.some((v) =>
                String(g.centre || "").startsWith(v.centre))) {
            problems.push(`${ref.id}: venue "${g.centre}"`);
        }
    }
    if (problems.length) {
        throw new Error(
            `[test_game] ${problems.length} written game(s) violate the rules:\n  ` +
            problems.join("\n  ")
        );
    }
    return refs.length;
}

/**
 * Delete every test game, whoever made it.
 *
 * Selects on `is_test_game` alone -- NOT on any per-seeder tag. A tag scopes a
 * purge to one script's own output, which is exactly how eleven seeders
 * accumulate each other's litter.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]
 */
async function purgeTestGames(db, opts = {}) {
    const snap = await db.collection("games")
        .where("is_test_game", "==", true).get();
    if (opts.dryRun) return { count: snap.size, deleted: false };

    // Chunked: a batch caps at 500 writes, and the live_events subcollection
    // has to go with its parent or it survives the game and accumulates.
    let n = 0;
    for (let i = 0; i < snap.docs.length; i += 200) {
        const chunk = snap.docs.slice(i, i + 200);
        for (const d of chunk) {
            const ev = await d.ref.collection("live_events").get();
            const b = db.batch();
            ev.docs.forEach((e) => b.delete(e.ref));
            b.delete(d.ref);
            await b.commit();
            n += 1;
        }
    }
    return { count: n, deleted: true };
}

/**
 * Find fixtures that escaped the rules -- the audit that would have caught this.
 *
 * Two questions the flag alone cannot answer:
 *   - a game AT the test venue with no flag (unpurgeable litter)
 *   - a flagged game NOT at the test venue (a fixture on a real pitch)
 *
 * @param {FirebaseFirestore.Firestore} db
 */
async function auditTestGames(db) {
    const flagged = await db.collection("games")
        .where("is_test_game", "==", true).get();

    // A fixture at ANY sanctioned venue that lost its flag is unpurgeable
    // litter, so every one of them is checked, not just the default.
    const unflaggedAtVenue = [];
    for (const v of SANCTIONED_VENUES) {
        const atVenue = await db.collection("games")
            .where("centre", "==", v.centre).get();
        atVenue.docs
            .filter((d) => d.data().is_test_game !== true)
            .forEach((d) => unflaggedAtVenue.push(d.id));
    }

    const flaggedOffVenue = flagged.docs
        .filter((d) => !SANCTIONED_VENUES.some((v) =>
            String(d.data().centre || "").startsWith(v.centre)))
        .map((d) => ({ id: d.id, centre: d.data().centre }));

    return { unflaggedAtVenue, flaggedOffVenue };
}

module.exports = {
    TEST_VENUE,
    REMOTE_VENUE,
    SANCTIONED_VENUES,
    longTestVenue,
    testGame,
    assertTestRoster,
    verifyWritten,
    purgeTestGames,
    auditTestGames,
};
