/**
 * Seeds PRIVATE games for testing the redesigned Home sections:
 * followed games (`games_interested` -> `followed_games_list`) and the
 * post-game card (`past_game_card_feedback` -> `post_game_card`).
 *
 * ============================================================================
 * THREE HARD GUARDS, ASSERTED AT RUN TIME. DO NOT SOFTEN THEM.
 * ============================================================================
 *
 * On 2026-08-17 a sibling seeder wrote PUBLIC games to LE FIVE Paris 17, Foot
 * POWER 5 and Stadium Thiais -- three of the busiest real venues, and the top
 * ten hold 66% of all upcoming games. Within 35 minutes a real player had
 * JOINED one and another had followed a second; deleting the seeds made a game
 * someone had signed up for vanish.
 *
 * The lesson was not "seed more carefully". It was that a guard covering ONE
 * risk (that seeded rosters contain only test accounts) is not evidence about
 * the others. So all three are checked here, and the script refuses to write if
 * any fails:
 *
 *   1. every game is `visibility: 'private'`   -- cannot enter anyone's feed
 *   2. every game is at VSD39 Dole             -- the venue nobody browses
 *   3. every roster uid is `is_test_account`   -- no real player on a fake pitch
 *
 * Usage:
 *   node seed_home_sections.js            # dry run, prints the plan
 *   node seed_home_sections.js --write    # replace and create
 *   node seed_home_sections.js --purge    # delete everything it made
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
});

const db = admin.firestore();
const WRITE = process.argv.includes("--write");
const PURGE = process.argv.includes("--purge");

const TAG = "home_sections_matrix";

// --- the three guards, as constants so the assertions can check them ---------
const REQUIRED_VISIBILITY = "private";
const TEST_VENUE = {
    centre: "VSD39 Dole",
    placeId: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
    lat: 47.0937,
    lng: 5.4901,
};

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2";
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";
const LIAM = "Go2YXYj9FFW6xG28HZNBcrDkIJV2";
const SOPHIE = "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2";
const TODD = "xz7cm07tVlZkt71QsLdmeTSCPYI3";

/** Everyone who may stand on a seeded pitch. Tim included; he is the tester. */
const POOL = [GINA, MARCO, LUCIA, NOAH, LIAM, SOPHIE, TODD];

const MIN = 60 * 1000;

/**
 * `teams` with `filled` taken spots out of `maxPlayers`.
 *
 * NEVER REUSES A UID. `POOL[i % POOL.length]` looks harmless and is not: a
 * repeated reference is what a +1 IS in this schema, so a game bigger than the
 * pool silently becomes "one player with N +1s". `filled` is clamped instead,
 * and a full game is made by shrinking maxPlayers.
 */
function roster(filled, maxPlayers, { includeTim = false } = {}) {
    const people = includeTim ? [TIM, ...POOL] : [...POOL];
    const take = Math.min(filled, people.length);
    if (take < filled) {
        throw new Error(
            `roster(${filled}, ${maxPlayers}): pool holds ${people.length}. ` +
            `Shrink maxPlayers rather than repeating a player.`
        );
    }
    const spots = [];
    for (let i = 0; i < maxPlayers; i++) {
        const taken = i < take;
        spots.push({
            user_id: taken ? people[i] : "",
            status: taken ? "confirmed" : "open",
            team_side: i % 2 === 0 ? "A" : "B",
            plus_one: false,
        });
    }
    return spots;
}

function at(offsetDays, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d;
}

/**
 * THE PLAN.
 *
 * `followed` games have Tim in `interested` but NOT in the roster -- that is
 * what following means, and an invitation is only written for someone who is
 * not already an attendee.
 *
 * `played` games have Tim IN the roster and land in `pending_feedback`, each
 * missing a different step so every branch of the post-game card renders.
 */
const PLAN = [
    // --- FOLLOWED (upcoming, Tim watching, not playing) ---------------------
    {
        kind: "followed", label: "followed · FULL · still waiting",
        date: at(1, 19, 0), filled: 6, max: 6, price: 8,
    },
    {
        kind: "followed", label: "followed · A SPOT OPENED · primary CTA",
        date: at(2, 20, 30), filled: 5, max: 6, price: 6,
    },
    {
        kind: "followed", label: "followed · CANCELED · acknowledge",
        date: at(3, 18, 0), filled: 6, max: 6, price: 0, status: "canceled",
    },

    // --- PLAYED (one only) --------------------------------------------------
    //
    // ONE game to wrap up, not four (Tim, 2026-08-17). The card no longer names
    // the missing step, so four played games would render four identical cards
    // -- a wall of the same ask, which is the exact problem the invitations
    // redesign existed to solve. The steps still need testing, but that belongs
    // in the flow behind the card, not in a pile on Home.
    //
    // Left deliberately at "needs everything": teams unconfirmed, no result, no
    // score. That is the state a real game is in the moment it ends, and it is
    // the one the full-screen flow has to handle.
    {
        kind: "played", label: "played · needs wrapping up",
        date: at(-1, 19, 0), filled: 6, max: 6, price: 5,
        teamsConfirmed: false, proposals: null,
    },
];

// ---------------------------------------------------------------- guards ----

async function assertGuards() {
    // GUARD 3: every pool uid is a test account.
    for (const uid of new Set([...POOL, TIM])) {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) {
            throw new Error(`pool uid ${uid} does not exist`);
        }
        if (uid === TIM) continue; // the tester, deliberately a real account
        if (snap.data().is_test_account !== true) {
            throw new Error(
                `pool uid ${uid} (${snap.data().display_name}) is NOT a test ` +
                `account. Every seeded player must have is_test_account: true.`
            );
        }
    }

    // GUARDS 1 and 2: nothing in the plan may be public or off-venue. These are
    // structural, but asserted anyway -- the whole point is that the script
    // cannot be edited into writing a public game without tripping something.
    if (REQUIRED_VISIBILITY !== "private") {
        throw new Error("REQUIRED_VISIBILITY must be 'private'");
    }
    if (TEST_VENUE.centre !== "VSD39 Dole") {
        throw new Error("seeded games must be at VSD39 Dole");
    }
    console.log("guards ok: private · VSD39 Dole · test accounts only\n");
}

/** Re-reads what was written and fails loudly if any guard was violated. */
async function verifyWritten() {
    const snap = await db.collection("games").where("seed_tag", "==", TAG).get();
    const bad = [];
    for (const d of snap.docs) {
        const x = d.data();
        if (x.visibility !== "private") bad.push(`${d.id} visibility=${x.visibility}`);
        if (x.centre !== TEST_VENUE.centre) bad.push(`${d.id} centre=${x.centre}`);
    }
    if (bad.length) {
        console.error("\n!! GUARD VIOLATION IN WRITTEN DATA:");
        bad.forEach((b) => console.error(`   ${b}`));
        console.error("   purge immediately: node seed_home_sections.js --purge");
        process.exit(1);
    }
    console.log(`verified ${snap.size} written game(s): all private, all at ${TEST_VENUE.centre}`);
}

async function purge() {
    const games = await db.collection("games").where("seed_tag", "==", TAG).get();
    console.log(`purging ${games.size} seeded game(s)`);
    const timRef = db.collection("users").doc(TIM);

    for (const g of games.docs) {
        // Chunked: "Transaction too big" is what you get for assuming one game
        // means a handful of related docs.
        const invs = await db.collection("game_invitations").where("game", "==", g.ref).get();
        for (let i = 0; i < invs.docs.length; i += 400) {
            const b = db.batch();
            invs.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
        }
        await timRef.update({
            pending_feedback: admin.firestore.FieldValue.arrayRemove(g.ref),
            played_games: admin.firestore.FieldValue.arrayRemove(g.ref),
        }).catch(() => {});
        await g.ref.delete();
    }
    console.log("purged.");
}

async function run() {
    await assertGuards();

    if (PURGE) {
        await purge();
        process.exit(0);
    }

    // Always clear the previous set first, so re-running replaces rather than
    // accumulates.
    if (WRITE) await purge();

    console.log(`seeding ${PLAN.length} PRIVATE game(s) at ${TEST_VENUE.centre}\n`);

    const timRef = db.collection("users").doc(TIM);
    const feedbackRefs = [];

    for (const p of PLAN) {
        const includeTim = p.kind === "played";
        const teams = roster(p.filled, p.max, { includeTim });
        const attendees = teams
            .filter((s) => s.user_id)
            .map((s) => db.collection("users").doc(s.user_id));

        console.log(
            `  ${p.date.toISOString().slice(0, 16).replace("T", " ")}  ` +
            `${String(p.filled).padStart(2)}/${p.max}  ${p.label}`
        );
        if (!WRITE) continue;

        const data = {
            seed_tag: TAG,
            is_test_game: true,
            // GUARD 1: never anything but private.
            visibility: REQUIRED_VISIBILITY,
            date: admin.firestore.Timestamp.fromDate(p.date),
            end_time: admin.firestore.Timestamp.fromDate(
                new Date(p.date.getTime() + 60 * MIN)
            ),
            duration: 60,
            status: p.status || (p.kind === "played" ? "played" : "published"),
            organizer: POOL[0],
            // GUARD 2: never anything but the test venue.
            centre: TEST_VENUE.centre,
            address: TEST_VENUE.centre,
            place_id: TEST_VENUE.placeId,
            location: new admin.firestore.GeoPoint(TEST_VENUE.lat, TEST_VENUE.lng),
            max_players: p.max,
            teams,
            attendees,
            interested: p.kind === "followed" ? [timRef] : [],
            price: p.price,
            price_undiscounted: p.price,
            currency: "EUR",
            payment_type: "on-site",
            sport: "soccer",
            level: 3,
            mood: "fun",
            time_zone: "Europe/Paris",
            reservation_name: p.label,
            created_on: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (p.teamsConfirmed) {
            data.live_teams_confirmed_at =
                admin.firestore.Timestamp.fromDate(new Date(p.date.getTime() + 5 * MIN));
        }
        if (p.proposals) {
            data.score_proposals = p.proposals;
        }

        const ref = await db.collection("games").add(data);
        if (p.kind === "played") feedbackRefs.push(ref);
    }

    if (WRITE && feedbackRefs.length) {
        await timRef.update({
            pending_feedback: admin.firestore.FieldValue.arrayUnion(...feedbackRefs),
            played_games: admin.firestore.FieldValue.arrayUnion(...feedbackRefs),
        });
        console.log(`\nadded ${feedbackRefs.length} game(s) to Tim's pending_feedback`);
    }

    if (WRITE) {
        console.log("");
        await verifyWritten();
    } else {
        console.log("\ndry run. re-run with --write to replace and create.");
    }
    process.exit(0);
}

run().catch((e) => {
    console.error("\n" + e.message);
    process.exit(1);
});
