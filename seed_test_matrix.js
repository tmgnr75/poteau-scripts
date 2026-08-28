/**
 * THE ONE SEEDER. Wipes everything this script has ever made for Tim's account
 * and lays down a fresh matrix covering the whole Home surface.
 *
 * Run it before any testing session. It is idempotent by construction: every
 * run purges by `seed_tag` first, so re-running replaces rather than
 * accumulates, and there is never a second generation of stale games to hunt.
 *
 * ============================================================================
 * THREE HARD GUARDS, ASSERTED AT RUN TIME. DO NOT SOFTEN THEM.
 * ============================================================================
 *
 * On 2026-08-17 a sibling seeder wrote PUBLIC games to LE FIVE Paris 17, Foot
 * POWER 5 and Stadium Thiais -- three of the busiest real venues. Within 35
 * minutes a real player had JOINED one and another had followed a second, and
 * deleting the seeds made a game somebody had signed up for vanish.
 *
 * The lesson was not "seed more carefully". It was that a guard covering ONE
 * risk (that rosters hold only test accounts) is not evidence about the others.
 * So all three are checked, and the script refuses to write if any fails:
 *
 *   1. every game is `visibility: 'private'`   -- cannot enter anyone's feed
 *   2. every game is at VSD39 Dole             -- the test venue, in the Jura,
 *                                                 NEVER the Paris area
 *   3. every roster uid is `is_test_account`   -- no real player on a fake pitch
 *
 * It then RE-READS what it wrote and exits non-zero if anything is off, because
 * asserting the plan is not the same as verifying the data.
 *
 * ---------------------------------------------------------------------------
 * WHAT IT SEEDS (Tim's matrix, 2026-08-17)
 * ---------------------------------------------------------------------------
 *
 *   upcoming        soccer + padel, several days out
 *   starting soon   inside the T-30 Live window, so the Live card shows
 *   already started kicked off, still running
 *   full            no spot left
 *   missing players spots open, in the shapes that actually occur
 *   past            played, to wrap up -- feeds the post-game flow
 *
 * Plus: every FUTURE declined invitation on Tim's account is flipped back to
 * `pending`, so the invitations surface has real content again without
 * fabricating any (Tim, 2026-08-17 -- he already has plenty).
 *
 * Usage:
 *   node seed_test_matrix.js            # dry run, prints the plan
 *   node seed_test_matrix.js --write    # purge, then create
 *   node seed_test_matrix.js --purge    # delete every test game, create nothing
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

const TAG = "test_matrix";

// --- the three guards, as constants so the assertions can check them ---------
const REQUIRED_VISIBILITY = "private";

/**
 * VSD39 Dole. In the Jura, 350km from Paris, and it carries five real games
 * all-time -- which is what "the venue nobody browses" means in practice.
 *
 * A second display name reusing this same place_id ("Padel Attitude") exists
 * from an earlier padel seeder. Deliberately NOT reused: one test venue is one
 * thing to purge and one name to recognise in the UI.
 */
const TEST_VENUE = {
    centre: "VSD39 Dole",
    placeId: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
    lat: 47.0937,
    lng: 5.4901,
};

/** Paris-area coordinates, used only to PROVE nothing is seeded near them. */
const PARIS = { lat: 48.8566, lng: 2.3522 };
const MIN_KM_FROM_PARIS = 100;

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
 * repeated reference is what a `+1` IS in this schema, so a game bigger than
 * the pool silently becomes "one player with N +1s" and every capacity number
 * lies. It throws instead, and the fix is a smaller game, never a repeat.
 *
 * `team_side` uses team_a/team_b -- the values the enum, the stats recompute
 * and Live's goal attribution all read. An earlier seeder wrote "A"/"B", which
 * no reader understands.
 */
function roster(filled, maxPlayers, { includeTim = false } = {}) {
    const people = includeTim ? [TIM, ...POOL] : [...POOL];
    if (filled > people.length) {
        throw new Error(
            `roster(${filled}, ${maxPlayers}): pool holds ${people.length}. ` +
            `Shrink the game rather than repeating a player -- a repeated uid is a +1.`
        );
    }
    const spots = [];
    for (let i = 0; i < maxPlayers; i++) {
        const taken = i < filled;
        spots.push({
            user_id: taken ? people[i] : "",
            status: taken ? "confirmed" : "open",
            team_side: i % 2 === 0 ? "team_a" : "team_b",
            plus_one: false,
        });
    }
    return spots;
}

/** Minutes from now, as a Date. Negative is in the past. */
function inMinutes(m) {
    return new Date(Date.now() + m * 60 * 1000);
}

function atDays(offsetDays, hour, minute) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, minute, 0, 0);
    return d;
}

/**
 * THE MATRIX.
 *
 * `mine: true` puts Tim in the roster (a game he joined). `mine: false` leaves
 * him out and puts him in `interested` instead, which is what FOLLOWING is --
 * and the amber card family on Home renders from it.
 *
 * Padel is 4 players, 2v2. Soccer sizes are kept at or under the pool so the
 * roster function never has to repeat anybody.
 */
const PLAN = [
    // --- ALREADY STARTED ----------------------------------------------------
    {
        label: "soccer · STARTED 20min ago · full · SCORING 2-1",
        sport: "soccer", startsIn: -20, duration: 60,
        filled: 6, max: 6, mine: true, price: 8, live: true,
        // A match genuinely UNDERWAY, not merely one whose clock has passed.
        // Without this every seeded game needed the teams step walked by hand
        // before anything mid-match could be looked at -- the green band, the
        // Lock Screen card and the watch all require confirmed teams.
        liveScore: { a: 2, b: 1 },
    },
    {
        label: "padel · STARTED 10min ago · full 2v2 · SCORING",
        sport: "padel", startsIn: -10, duration: 90,
        filled: 4, max: 4, mine: true, price: 12, live: true,
        // Five points to us, three to them: inside the first game of the first
        // set, so the board shows 40-40 territory rather than a finished set.
        liveScore: { a: 5, b: 3 },
    },

    // --- STARTING IN LESS THAN 30 MIN (inside the Live window) --------------
    {
        label: "soccer · starts in 15min · full · LIVE WINDOW OPEN",
        sport: "soccer", startsIn: 15, duration: 60,
        filled: 6, max: 6, mine: true, price: 7, live: true,
    },
    {
        label: "padel · starts in 25min · full 2v2 · LIVE WINDOW OPEN",
        sport: "padel", startsIn: 25, duration: 90,
        filled: 4, max: 4, mine: true, price: 14, live: true,
    },

    // --- STARTING IN MORE THAN 30 MIN (window still shut) -------------------
    {
        label: "soccer · starts in 2h · one spot left",
        sport: "soccer", startsIn: 120, duration: 60,
        filled: 5, max: 6, mine: true, price: 6,
    },
    {
        label: "padel · starts in 3h · full 2v2",
        sport: "padel", startsIn: 180, duration: 90,
        filled: 4, max: 4, mine: true, price: 11,
    },

    // --- UPCOMING, FURTHER OUT ----------------------------------------------
    {
        label: "soccer · tomorrow · HALF EMPTY",
        sport: "soccer", date: atDays(1, 19, 0), duration: 60,
        filled: 3, max: 6, mine: true, price: 8,
    },
    {
        label: "soccer · in 3 days · NEARLY EMPTY (2 of 8)",
        sport: "soccer", date: atDays(3, 20, 30), duration: 60,
        filled: 2, max: 8, mine: true, price: 5,
    },
    {
        label: "padel · in 2 days · one spot left",
        sport: "padel", date: atDays(2, 18, 30), duration: 90,
        filled: 3, max: 4, mine: true, price: 13,
    },

    // --- FOLLOWED (upcoming, Tim watching, NOT playing) ---------------------
    {
        label: "soccer · FOLLOWED · full · in 4 days",
        sport: "soccer", date: atDays(4, 19, 0), duration: 60,
        filled: 6, max: 6, mine: false, price: 8,
    },
    {
        label: "padel · FOLLOWED · a spot opened · in 5 days",
        sport: "padel", date: atDays(5, 20, 0), duration: 90,
        filled: 3, max: 4, mine: false, price: 12,
    },

    // --- PAST, TO WRAP UP ---------------------------------------------------
    //
    // Both land in Tim's `pending_feedback` and drive the post-game flow.
    // Deliberately left at "needs everything": teams unconfirmed, no result, no
    // score. That is the state a real game is in the moment it ends, and it is
    // the one the flow has to handle.
    {
        label: "soccer · PLAYED yesterday · wrap up",
        sport: "soccer", date: atDays(-1, 19, 0), duration: 60,
        filled: 6, max: 6, mine: true, price: 5, played: true,
    },
    {
        label: "padel · PLAYED 2 days ago · wrap up",
        sport: "padel", date: atDays(-2, 18, 0), duration: 90,
        filled: 4, max: 4, mine: true, price: 12, played: true,
    },

    // --- PLAYED, WITH A SETTLED SCORE ---------------------------------------
    //
    // The only cases where `score_proposals` exists, which is what the game
    // sheet's FINAL band reads. Distinct from the two above deliberately:
    // those are games still awaiting a wrap-up, and a game whose score is
    // already agreed is a different state, not a later stage of the same one.
    {
        label: "soccer · PLAYED 3 days ago · SCORE RECORDED 3-2",
        sport: "soccer", date: atDays(-3, 19, 0), duration: 60,
        filled: 6, max: 6, mine: true, price: 6,
        // One period, which is the football case.
        finalScore: [{ team_a: 3, team_b: 2 }],
    },
    {
        label: "padel · PLAYED 4 days ago · SCORE RECORDED 2-1 in sets",
        sport: "padel", date: atDays(-4, 18, 30), duration: 90,
        filled: 4, max: 4, mine: true, price: 13,
        // THREE SETS, WON 2-1. The case worth seeding: summing these games
        // gives 19-13, and the sheet must read 2-1. Anything that regresses
        // `finalScoreNumbers` to a sum shows up here immediately.
        finalScore: [
            { team_a: 6, team_b: 0 },
            { team_a: 6, team_b: 7 },
            { team_a: 7, team_b: 6 },
        ],
    },
];

// ---------------------------------------------------------------- guards ----

/** Rough great-circle distance in km. Only needs to be right to a few km. */
function kmFrom(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

async function assertGuards() {
    // GUARD 3: every pool uid exists and is a test account.
    for (const uid of new Set([...POOL, TIM])) {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) throw new Error(`pool uid ${uid} does not exist`);
        if (uid === TIM) continue; // the tester, deliberately a real account
        if (snap.data().is_test_account !== true) {
            throw new Error(
                `pool uid ${uid} (${snap.data().display_name}) is NOT a test ` +
                `account. Every seeded player must have is_test_account: true.`
            );
        }
    }

    // GUARD 1 and 2: structural, but asserted anyway -- the point is that this
    // script cannot be edited into writing a public or Paris game without
    // tripping something.
    if (REQUIRED_VISIBILITY !== "private") {
        throw new Error("REQUIRED_VISIBILITY must be 'private'");
    }
    if (TEST_VENUE.centre !== "VSD39 Dole") {
        throw new Error("seeded games must be at VSD39 Dole");
    }

    // GUARD 2b: prove the venue is nowhere near Paris, rather than trusting the
    // name. A renamed constant with Paris coordinates is exactly the mistake
    // that caused the 2026-08-17 incident.
    const d = kmFrom(TEST_VENUE.lat, TEST_VENUE.lng, PARIS.lat, PARIS.lng);
    if (d < MIN_KM_FROM_PARIS) {
        throw new Error(
            `test venue is ${Math.round(d)}km from Paris, closer than the ` +
            `${MIN_KM_FROM_PARIS}km floor. Refusing to seed.`
        );
    }

    // Every planned game must fit its roster without repeating anybody.
    for (const p of PLAN) {
        roster(p.filled, p.max, { includeTim: p.mine !== false });
    }

    console.log(
        `guards ok: private · ${TEST_VENUE.centre} ` +
        `(${Math.round(d)}km from Paris) · test accounts only\n`
    );
}

/** Re-reads what was written and fails loudly if any guard was violated. */
async function verifyWritten() {
    const snap = await db.collection("games").where("seed_tag", "==", TAG).get();
    const bad = [];
    for (const doc of snap.docs) {
        const x = doc.data();
        if (x.visibility !== REQUIRED_VISIBILITY) bad.push(`${doc.id} visibility=${x.visibility}`);
        if (x.centre !== TEST_VENUE.centre) bad.push(`${doc.id} centre=${x.centre}`);
        if (x.location) {
            const km = kmFrom(x.location.latitude, x.location.longitude, PARIS.lat, PARIS.lng);
            if (km < MIN_KM_FROM_PARIS) bad.push(`${doc.id} is ${Math.round(km)}km from Paris`);
        }
    }
    if (bad.length) {
        console.error("\n!! GUARD VIOLATION IN WRITTEN DATA:");
        bad.forEach((b) => console.error(`   ${b}`));
        console.error("   purge immediately: node seed_test_matrix.js --purge");
        process.exit(1);
    }
    console.log(
        `verified ${snap.size} written game(s): all private, all at ` +
        `${TEST_VENUE.centre}, none within ${MIN_KM_FROM_PARIS}km of Paris`
    );
}

/**
 * Delete every test game on Tim's account, and unpick the references to it
 * that live on user documents.
 *
 * Selects on `is_test_game`, NOT on this script's own `seed_tag`. Tagging was
 * too narrow: every other seeder (padel live matrix, card states, home
 * sections, ...) writes its own tag, so their games accumulated forever and
 * Tim had to purge by hand. Anything flagged as a test game is fair game here.
 *
 * Refuses to touch a game that reached a real person -- an invitation, a
 * notification, a chat message, or a payment belonging to someone who is not
 * Tim and not a test account. Deleting those would erase invitations real
 * users still hold. Such games are reported and skipped.
 *
 * Chunked: "Transaction too big" is what you get for assuming one game means a
 * handful of related documents.
 */
async function purge() {
    const timRef = db.collection("users").doc(TIM);

    const flagged = await db.collection("games").where("is_test_game", "==", true).get();
    const games = { docs: [] };
    const skipped = [];

    // A uid is "safe" if it is Tim or an is_test_account. Cached: the same
    // handful of test users appears on every seeded game.
    const safeCache = new Map([[TIM, true]]);
    async function isSafe(uid) {
        if (!uid) return true;
        if (safeCache.has(uid)) return safeCache.get(uid);
        const u = await db.collection("users").doc(uid).get();
        const safe = !u.exists || u.data().is_test_account === true;
        safeCache.set(uid, safe);
        return safe;
    }

    for (const g of flagged.docs) {
        const d = g.data();

        // NOT GATED ON TIM BEING ON THE GAME (fixed 2026-08-20).
        //
        // This used to `continue` on any test game Tim was neither organizer
        // nor attendee of. Silently: not deleted, not counted, not reported.
        // So every OTHER session's seeded games survived every purge and piled
        // up -- 22 games at VSD39 Dole when the run claimed to write 13, three
        // of them from `home_sections_matrix` with no `team_side` at all, which
        // is what Tim saw as "no players in my spots".
        //
        // The safety property that matters is "no REAL player was touched",
        // which `why` computes below from is_test_account. Whether Tim happens
        // to be on the pitch is irrelevant to that -- and gating on it made the
        // purge weaker precisely for the games nobody was watching.
        const why = [];

        // A game whose roster contains a non-test account is not ours to
        // delete, even though something flagged it as a test game.
        for (const spot of d.teams || []) {
            if (spot?.user_id && !(await isSafe(spot.user_id))) {
                why.push(`${spot.user_id} holds a spot`);
            }
        }
        for (const r of d.attendees || []) {
            if (r?.id && !(await isSafe(r.id))) why.push(`${r.id} is an attendee`);
        }
        if (d.organizer && d.organizer !== TIM && !(await isSafe(d.organizer))) {
            why.push(`organized by ${d.organizer}`);
        }

        const [conns, invs, msgs, pays] = await Promise.all([
            db.collection("connect").where("game", "==", g.ref).get(),
            db.collection("game_invitations").where("game", "==", g.ref).get(),
            db.collection("messages").where("game_id", "==", g.ref).get(),
            db.collection("payments").where("game_ref", "==", g.ref).get(),
        ]);
        for (const p of pays.docs) {
            if (p.data().user_ref?.id !== TIM) why.push(`payment ${p.id} is not Tim's`);
        }
        for (const c of conns.docs) {
            for (const r of c.data().recipient || []) {
                if (r?.id && r.id !== "Team-App" && !(await isSafe(r.id))) why.push(`notified ${r.id}`);
            }
        }
        for (const i of invs.docs) {
            for (const uid of [i.data().invitee?.id, i.data().inviter?.id]) {
                if (uid && uid !== "Team-App" && !(await isSafe(uid))) why.push(`invited ${uid}`);
            }
        }
        for (const m of msgs.docs) {
            const uid = m.data().author_id?.id;
            if (uid && !(await isSafe(uid))) why.push(`${uid} wrote in the chat`);
        }

        if (why.length) skipped.push({ id: g.id, why: [...new Set(why)] });
        else games.docs.push(g);
    }

    console.log(
        `purging ${games.docs.length} of ${flagged.size} flagged test game(s)`);
    if (skipped.length) {
        console.log(`SKIPPING ${skipped.length} that reached real people:`);
        for (const s of skipped) console.log(`  ${s.id}: ${s.why.slice(0, 3).join(", ")}`);
    }

    for (const g of games.docs) {
        const invs = await db.collection("game_invitations").where("game", "==", g.ref).get();
        for (let i = 0; i < invs.docs.length; i += 400) {
            const b = db.batch();
            invs.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
        }
        // Live events are a subcollection, so deleting the parent leaves them
        // orphaned and invisible -- and a later game reusing the id would
        // inherit somebody else's score.
        const events = await g.ref.collection("live_events").get();
        for (let i = 0; i < events.docs.length; i += 400) {
            const b = db.batch();
            events.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
            await b.commit();
        }
        // Chat, notifications, guests and payments all point back at the game.
        // Leaving them behind is what left 263 messages and 222 connect docs
        // orphaned across earlier seeded games.
        for (const [coll, field] of [
            ["messages", "game_id"],
            ["connect", "game"],
            ["payments", "game_ref"],
        ]) {
            const snap = await db.collection(coll).where(field, "==", g.ref).get();
            for (let i = 0; i < snap.docs.length; i += 400) {
                const b = db.batch();
                snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
                await b.commit();
            }
        }
        const outsiders = await g.ref.collection("outsiders").get();
        for (const o of outsiders.docs) await o.ref.delete();

        // games and pending_votes were missing here, so a purged game kept a
        // dead ref on the user doc and showed up as a phantom row.
        await timRef.update({
            games: admin.firestore.FieldValue.arrayRemove(g.ref),
            pending_feedback: admin.firestore.FieldValue.arrayRemove(g.ref),
            pending_votes: admin.firestore.FieldValue.arrayRemove(g.ref),
            played_games: admin.firestore.FieldValue.arrayRemove(g.ref),
            upcoming_games: admin.firestore.FieldValue.arrayRemove(g.ref),
        }).catch(() => {});
        await g.ref.delete();
    }
    console.log("purged.");
}

/**
 * Flip every FUTURE declined invitation on Tim's account back to `pending`.
 *
 * Home queries `invitee == me AND status == 'pending' AND game_date >= now`, so
 * a declined invitation is invisible and un-declining it is what refills the
 * surface. Tim already receives plenty (12k/hour are generated platform-wide),
 * so fabricating more would only add noise.
 *
 * PAST invitations are deliberately left alone: flipping them changes nothing
 * on screen, and it would rewrite history for games already played.
 */
async function undeclineFutureInvitations() {
    const timRef = db.collection("users").doc(TIM);
    const now = admin.firestore.Timestamp.now();

    const snap = await db
        .collection("game_invitations")
        .where("invitee", "==", timRef)
        .where("status", "==", "declined")
        .get();

    const future = snap.docs.filter((d) => {
        const gd = d.data().game_date;
        return gd && gd.toMillis() > now.toMillis();
    });

    console.log(
        `\ninvitations: ${snap.size} declined, ${future.length} of them for future games`
    );
    if (!WRITE || !future.length) return;

    for (let i = 0; i < future.length; i += 400) {
        const b = db.batch();
        future.slice(i, i + 400).forEach((d) => b.update(d.ref, { status: "pending" }));
        await b.commit();
    }
    console.log(`un-declined ${future.length} future invitation(s)`);
}

async function run() {
    await assertGuards();

    if (PURGE) {
        await purge();
        process.exit(0);
    }

    // Always clear the previous set first, so re-running replaces rather than
    // accumulates. This is what makes the script safe to run before every
    // session without thinking about it.
    if (WRITE) await purge();

    console.log(`seeding ${PLAN.length} PRIVATE game(s) at ${TEST_VENUE.centre}\n`);

    const timRef = db.collection("users").doc(TIM);
    const feedbackRefs = [];

    for (const p of PLAN) {
        const mine = p.mine !== false;
        const date = p.date || inMinutes(p.startsIn);
        const teams = roster(p.filled, p.max, { includeTim: mine });
        const attendees = teams
            .filter((s) => s.user_id)
            .map((s) => db.collection("users").doc(s.user_id));

        const when = date.toISOString().slice(0, 16).replace("T", " ");
        console.log(`  ${when}  ${String(p.filled).padStart(2)}/${p.max}  ${p.label}`);
        if (!WRITE) continue;

        const data = {
            seed_tag: TAG,
            is_test_game: true,
            // GUARD 1: never anything but private.
            visibility: REQUIRED_VISIBILITY,
            date: admin.firestore.Timestamp.fromDate(date),
            end_time: admin.firestore.Timestamp.fromDate(
                new Date(date.getTime() + p.duration * MIN)
            ),
            duration: p.duration,
            status: (p.played || p.finalScore) ? "played" : "published",
            organizer: mine ? TIM : POOL[0],
            // GUARD 2: never anything but the test venue.
            centre: TEST_VENUE.centre,
            address: TEST_VENUE.centre,
            place_id: TEST_VENUE.placeId,
            location: new admin.firestore.GeoPoint(TEST_VENUE.lat, TEST_VENUE.lng),
            max_players: p.max,
            teams,
            attendees,
            interested: mine ? [] : [timRef],
            price: p.price,
            price_undiscounted: p.price,
            currency: "EUR",
            payment_type: "on-site",
            sport: p.sport,
            // `type` and `level_deltas` were never seeded at all, so a seeded
            // game read as "undefined" wherever the app shows the format or
            // the level spread -- the padel wrap-up game was the one Tim
            // caught (2026-08-25).
            //
            // The format follows max_players: padel is always 2v2, soccer is
            // whatever half the pitch holds.
            type: p.sport === "padel" ? "2v2" : `${p.max / 2}v${p.max / 2}`,
            level_deltas: [],
            level: 3,
            mood: "fun",
            time_zone: "Europe/Paris",
            reservation_name: p.label,
            // A DESCRIPTION ON EVERY FIXTURE (Tim, 2026-08-28).
            //
            // The seeder never wrote one, so the description section of the
            // game sheet had no content in any test -- which is why it looked
            // like it had stopped working. It had not: only 9% of real future
            // games carry a description, so the section is simply empty most
            // of the time in production too.
            //
            // Deliberately mundane text. A fixture description must never
            // contain a phone number or a link: that is exactly the content
            // the Gold gate exists to protect, and seeding it would put a
            // realistic-looking bypass target in the database.
            description: p.description ||
                'Terrain synthétique, vestiaires et douches sur place. ' +
                'Chasubles fournies, prévoir des baskets propres.',
            created_on: admin.firestore.FieldValue.serverTimestamp(),
        };

        // A SETTLED SCORE, shaped exactly as `enterResult` writes one.
        //
        // `periods`, never a flat a/b pair: reducing periods to a match score is
        // sport-dependent and deliberately not stored -- football sums them,
        // padel counts sets won. See matchScore() in gen2/recomputeUserStats.js
        // and finalScoreNumbers() in the app.
        if (p.finalScore) {
            data.score_proposals = [{
                periods: p.finalScore,
                proposed_by: TIM,
                proposed_at: admin.firestore.Timestamp.fromDate(
                    new Date(date.getTime() + p.duration * MIN)
                ),
                agreed_by: [TIM],
            }];
        }

        // Poteau Live is per-game and opt-in: a game without the flag never
        // shows a scoreboard, whatever Remote Config says.
        if (p.live) data.poteau_live = true;

        // Teams must be confirmed before a match counts as underway. This is
        // the gate the game card's green LIVE band, the Lock Screen Activity
        // and the watch all read -- kickoff alone is only "the clock passed".
        if (p.liveScore) {
            data.live_teams_confirmed_at =
                admin.firestore.Timestamp.fromDate(inMinutes(p.startsIn - 2));
        }

        const ref = await db.collection("games").add(data);
        if (p.played) feedbackRefs.push(ref);

        // The score is a LOG, never a stored number. Points are appended as
        // ordinary events and the fold derives the score from them, exactly as
        // a real tap does -- so a seeded match and a played one are
        // indistinguishable downstream. Writing an `a`/`b` field instead would
        // seed a state the app can never itself produce.
        if (p.liveScore) {
            const kickoff = inMinutes(p.startsIn);
            let n = 0;
            for (const side of ["team_a", "team_b"]) {
                const count = side === "team_a" ? p.liveScore.a : p.liveScore.b;
                for (let i = 0; i < count; i++) {
                    // Spread through the elapsed time so the minutes read
                    // plausibly rather than every goal landing at kickoff.
                    const at = new Date(kickoff.getTime() + (++n) * 90 * 1000);
                    await ref.collection("live_events").add({
                        type: "point",
                        side,
                        created_by: TIM,
                        created_at: admin.firestore.Timestamp.fromDate(at),
                        client_at: admin.firestore.Timestamp.fromDate(at),
                        client_event_id: `seed_${ref.id}_${n}`,
                    });
                }
            }
        }
    }

    if (WRITE && feedbackRefs.length) {
        await timRef.update({
            pending_feedback: admin.firestore.FieldValue.arrayUnion(...feedbackRefs),
            played_games: admin.firestore.FieldValue.arrayUnion(...feedbackRefs),
        });
        console.log(`\nadded ${feedbackRefs.length} game(s) to Tim's pending_feedback`);
    }

    await undeclineFutureInvitations();

    if (WRITE) {
        console.log("");
        await verifyWritten();
    } else {
        console.log("\ndry run. re-run with --write to purge and create.");
    }
    process.exit(0);
}

run().catch((e) => {
    console.error("\n" + e.message);
    process.exit(1);
});
