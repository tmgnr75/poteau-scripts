/**
 * THE WRAP-UP EDGE-CASE MATRIX.
 *
 * `seed_test_matrix.js` seeds the HOME surface: a realistic spread of games so
 * the app looks alive. This seeds the WRAP-UP FLOW instead: one game per case
 * the post-game card and the score steps have to survive, including the ones
 * nobody would think to click through by hand.
 *
 * Every case is drawn from what production actually contains, measured
 * 2026-08-26 across 132 played padel games and 82,042 played soccer games:
 *
 *   - 81% of soccer games have at least one `+1`. The guest path is the
 *     NORMAL path, not an edge case.
 *   - 2,275 soccer games have UNEVEN sides. 3v2 and 4v3 must not look broken.
 *   - Rosters run from 0 to 24 filled spots.
 *   - 19 soccer games have an EMPTY `teams` array.
 *   - 26% of venue names exceed 22 characters; the longest is 81.
 *   - ZERO games have a score or a result today, because 5.2.0 ships them.
 *     The unscored card is not a fallback, it is the only case that exists.
 *
 * ---------------------------------------------------------------------------
 * THE SAME THREE GUARDS AS THE MAIN SEEDER, ASSERTED THE SAME WAY.
 * ---------------------------------------------------------------------------
 *   1. every game is `visibility: 'private'`
 *   2. every game is at VSD39 Dole, 305km from Paris
 *   3. every roster uid is a known test account
 *
 * Usage:
 *   node seed_wrapup_cases.js            # dry run, prints the matrix
 *   node seed_wrapup_cases.js --write    # purge, then create
 *   node seed_wrapup_cases.js --purge    # delete the cases, create nothing
 *   node seed_wrapup_cases.js --verify   # re-read and check each case
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
const VERIFY = process.argv.includes("--verify");

/** Its own tag, so this never purges the home matrix and vice versa. */
const SEED_TAG = "wrapup_cases";

const REQUIRED_VISIBILITY = "private";
const TEST_VENUE = {
    centre: "VSD39 Dole",
    placeId: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
    lat: 47.0937,
    lng: 5.4901,
};
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
const POOL = [GINA, MARCO, LUCIA, NOAH, LIAM, SOPHIE, TODD];
const KNOWN = new Set([TIM, ...POOL]);

/**
 * A roster. `sides` is [teamA, teamB] counts; Tim always takes the first
 * team_a spot so every card has a "me" to highlight.
 *
 * `guests` adds that many +1 spots to team_a, each repeating its HOST's uid --
 * which is what a +1 IS in this schema, not a bug.
 */
function roster([a, b], { guests = 0, tim = true } = {}) {
    const out = [];
    let n = 0;
    const take = () => {
        const uid = POOL[n++];
        if (!uid) throw new Error("roster larger than the test pool");
        return uid;
    };
    for (let i = 0; i < a; i++) {
        const uid = tim && i === 0 ? TIM : take();
        out.push(spot(out.length + 1, "team_a", uid, false));
    }
    for (let i = 0; i < guests; i++) {
        // A guest repeats its host's uid: the first team_a player brought them.
        out.push(spot(out.length + 1, "team_a", out[0].user_id, true));
    }
    for (let i = 0; i < b; i++) {
        out.push(spot(out.length + 1, "team_b", take(), false));
    }
    return out;
}

function spot(number, side, uid, plusOne) {
    return {
        spot_number: number,
        team_side: side,
        status: "confirmed",
        position: null,
        user_id: uid,
        plus_one: plusOne,
    };
}

function daysAgo(d, hour = 18) {
    const t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(hour, 0, 0, 0);
    return t;
}

/** football: one period IS the score. padel: one period per set. */
function period(a, b, { tieBreak = false, superTieBreak = false } = {}) {
    return {
        team_a: a,
        team_b: b,
        tie_break: tieBreak,
        super_tie_break: superTieBreak,
    };
}

function scoreProposal(periods) {
    return [
        {
            proposed_by: TIM,
            proposed_at: new Date(),
            periods,
            agreed_by: [TIM],
        },
    ];
}

function resultProposal(winningSide, isDraw = false) {
    return [
        {
            winning_side: winningSide,
            is_draw: isDraw,
            proposed_by: TIM,
            proposed_at: new Date(),
            agreed_by: [TIM],
        },
    ];
}

// ---------------------------------------------------------------- the matrix

/**
 * Each case is one game plus what the card is EXPECTED to show, so `--verify`
 * can check the data rather than a human checking a screenshot.
 */
const CASES = [
    // ---- padel: the score shapes -----------------------------------------
    {
        id: "padel-straight-sets",
        why: "2-0. The commonest padel result. No third set row anywhere.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: scoreProposal([period(6, 4), period(6, 3)]),
        result: resultProposal("team_a"),
        expect: { periods: 2, setsA: 2, setsB: 0, verdict: "won" },
    },
    {
        id: "padel-three-sets-super-tb",
        why: "1-1 then a super tie-break to 10. The flag must be on set 3 only.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: scoreProposal([
            period(6, 4),
            period(6, 7, { tieBreak: true }),
            period(10, 8, { superTieBreak: true }),
        ]),
        result: resultProposal("team_a"),
        expect: { periods: 3, setsA: 2, setsB: 1, verdict: "won" },
    },
    {
        id: "padel-lost-in-three",
        why: "A LOSS must be as postable as a win. Nothing red, nothing shouty.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: scoreProposal([
            period(4, 6),
            period(7, 6, { tieBreak: true }),
            period(8, 10, { superTieBreak: true }),
        ]),
        result: resultProposal("team_b"),
        expect: { periods: 3, setsA: 1, setsB: 2, verdict: "lost" },
    },
    {
        id: "padel-7-5-set",
        why: "7-5 is a legal set and NOT a tie-break. The label must not say TB.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: scoreProposal([period(7, 5), period(6, 2)]),
        result: resultProposal("team_a"),
        expect: { periods: 2, setsA: 2, setsB: 0, verdict: "won" },
    },
    {
        id: "padel-no-score",
        why: "TODAY'S ONLY REAL CASE. No sets, no result: faces and a venue.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: null,
        result: null,
        expect: { periods: 0, verdict: null },
    },
    {
        id: "padel-result-no-score",
        why: "Score skipped, result given. The verdict carries the card alone.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: null,
        result: resultProposal("team_a"),
        expect: { periods: 0, verdict: "won" },
    },

    // ---- soccer: the score shapes ----------------------------------------
    {
        id: "soccer-win-with-goals",
        why: "The card's best case: a win, and the sharer scored.",
        sport: "soccer",
        sides: [3, 3],
        duration: 60,
        score: scoreProposal([period(3, 1)]),
        result: resultProposal("team_a"),
        goals: 2,
        expect: { periods: 1, verdict: "won", myGoals: 2 },
    },
    {
        id: "soccer-goalless-draw",
        why: "0-0 must NOT render as a glowing zero. The word carries it.",
        sport: "soccer",
        sides: [4, 4],
        duration: 60,
        score: scoreProposal([period(0, 0)]),
        result: resultProposal(null, true),
        expect: { periods: 1, verdict: "draw" },
    },
    {
        id: "soccer-lost-but-scored",
        why: "Scored in a defeat. The homage must drop the result, not state it.",
        sport: "soccer",
        sides: [4, 4],
        duration: 90,
        score: scoreProposal([period(2, 5)]),
        result: resultProposal("team_b"),
        goals: 2,
        expect: { periods: 1, verdict: "lost", myGoals: 2 },
    },
    {
        id: "soccer-no-score",
        why: "The commonest soccer case today. No panel at all.",
        sport: "soccer",
        sides: [4, 4],
        duration: 60,
        score: null,
        result: null,
        expect: { periods: 0, verdict: null },
    },

    // ---- roster shapes ---------------------------------------------------
    {
        id: "roster-uneven-3v2",
        why: "2,275 production games have uneven sides. Must not look broken.",
        sport: "soccer",
        sides: [3, 2],
        duration: 60,
        score: scoreProposal([period(4, 2)]),
        result: resultProposal("team_a"),
        expect: { periods: 1, verdict: "won", filled: 5 },
    },
    {
        id: "roster-with-guests",
        why: "81% of production games have a +1. A guest is a SPOT, not a person.",
        sport: "soccer",
        sides: [3, 3],
        guests: 2,
        duration: 60,
        score: scoreProposal([period(2, 1)]),
        result: resultProposal("team_a"),
        expect: { periods: 1, verdict: "won", filled: 8, guests: 2 },
    },
    {
        id: "roster-empty-side",
        why: "5 padel and 12 soccer production games have one side empty.",
        sport: "soccer",
        sides: [4, 0],
        duration: 60,
        score: null,
        result: null,
        expect: { periods: 0, verdict: null, filled: 4 },
    },
    {
        id: "roster-big-11v11",
        why: "The largest roster the 8-account test pool allows. Production reaches 24; a bigger case needs more test users, not repeated uids -- a repeat IS a +1 in this schema.",
        sport: "soccer",
        sides: [4, 4],
        duration: 90,
        score: scoreProposal([period(1, 0)]),
        result: resultProposal("team_a"),
        expect: { periods: 1, verdict: "won", filled: 8 },
    },

    // ---- text shapes -----------------------------------------------------
    {
        id: "venue-very-long-name",
        why: "An 81-char venue exists in production. Must not push the card around.",
        sport: "soccer",
        sides: [3, 3],
        duration: 60,
        centre: "Complexe Sportif Intercommunal Marcel Cerdan de Saint-Ouen-sur-Seine Nord",
        score: scoreProposal([period(2, 2)]),
        result: resultProposal(null, true),
        expect: { periods: 1, verdict: "draw" },
    },
    {
        id: "roster-empty-teams",
        why: "19 production games have an EMPTY teams array. No faces at all.",
        sport: "soccer",
        sides: [0, 0],
        duration: 60,
        score: scoreProposal([period(1, 1)]),
        result: resultProposal(null, true),
        expect: { periods: 1, verdict: "draw", filled: 0 },
    },
    {
        id: "padel-pair-with-guest",
        why: "108 of 132 padel games have a +1. A guest fills a padel seat too.",
        sport: "padel",
        sides: [1, 2],
        guests: 1,
        duration: 90,
        score: scoreProposal([period(6, 1), period(6, 0)]),
        result: resultProposal("team_a"),
        expect: { periods: 2, setsA: 2, setsB: 0, verdict: "won", guests: 1 },
    },
    {
        id: "padel-five-periods",
        why: "Live appends as it goes: a group playing on can store more than three sets. The card must cap, not overflow.",
        sport: "padel",
        sides: [2, 2],
        duration: 90,
        score: scoreProposal([
            period(6, 4),
            period(6, 3),
            period(6, 2),
            period(4, 6),
            period(6, 1),
        ]),
        result: resultProposal("team_a"),
        expect: { periods: 5, verdict: "won" },
    },
    {
        id: "soccer-high-scoring",
        why: "Double digits must not overflow the scoreline box.",
        sport: "soccer",
        sides: [4, 4],
        duration: 90,
        score: scoreProposal([period(12, 11)]),
        result: resultProposal("team_a"),
        goals: 4,
        expect: { periods: 1, verdict: "won", myGoals: 4 },
    },
    {
        id: "duration-45-minutes",
        why: "Under an hour keeps minutes: 45MIN, never 0H45.",
        sport: "soccer",
        sides: [3, 3],
        duration: 45,
        score: null,
        result: null,
        expect: { periods: 0, verdict: null },
    },
];

// ------------------------------------------------------------------ guards

function kmFrom(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function assertGuards(docs) {
    for (const g of docs) {
        if (g.visibility !== REQUIRED_VISIBILITY) {
            throw new Error(`${g.seed_case}: not private`);
        }
        if (g.centre_place_id !== TEST_VENUE.placeId) {
            throw new Error(`${g.seed_case}: not at the test venue`);
        }
        for (const s of g.teams) {
            if (s.user_id && !KNOWN.has(s.user_id)) {
                throw new Error(`${g.seed_case}: unknown uid ${s.user_id}`);
            }
        }
    }
    const km = kmFrom(TEST_VENUE.lat, TEST_VENUE.lng, PARIS.lat, PARIS.lng);
    if (km < MIN_KM_FROM_PARIS) {
        throw new Error(`test venue only ${km.toFixed(0)}km from Paris`);
    }
    console.log(
        `guards ok: private · ${TEST_VENUE.centre} (${km.toFixed(0)}km from Paris) · test accounts only\n`
    );
}

// ------------------------------------------------------------------- build

function build(c, i) {
    const teams = roster(c.sides, { guests: c.guests || 0 });
    const date = daysAgo(2 + i, 18);
    return {
        seed_tag: SEED_TAG,
        seed_case: c.id,
        sport: c.sport,
        status: "played",
        visibility: REQUIRED_VISIBILITY,
        centre: c.centre || TEST_VENUE.centre,
        address: TEST_VENUE.centre,
        centre_place_id: TEST_VENUE.placeId,
        place_id: TEST_VENUE.placeId,
        location: new admin.firestore.GeoPoint(TEST_VENUE.lat, TEST_VENUE.lng),
        date,
        end_time: new Date(date.getTime() + c.duration * 60000),
        duration: c.duration,
        max_players: teams.length,
        organizer: TIM,
        teams,
        attendees: teams.map((t) => db.doc(`users/${t.user_id}`)),
        time_zone: "Europe/Paris",
        type: "public_game",
        level_deltas: [],
        // Stamped so the wrap-up SKIPS the teams step: these cases exist to
        // exercise the CARD, and a flow that stops to ask about sides on every
        // one of them cannot be walked in a single pass.
        live_teams_confirmed_at: date,
        score_proposals: c.score || [],
        result_proposals: c.result || [],
        created_on: date,
    };
}

// ------------------------------------------------------------------- purge

async function purge() {
    const q = await db
        .collection("games")
        .where("seed_tag", "==", SEED_TAG)
        .get();
    let n = 0;
    for (const d of q.docs) {
        // Cheap safety: these are ours by tag, but never delete something a
        // real person has touched.
        const teams = d.get("teams") || [];
        if (teams.some((t) => t.user_id && !KNOWN.has(t.user_id))) {
            console.log(`  SKIPPING ${d.id}: a real uid is on it`);
            continue;
        }
        await d.ref.delete();
        n++;
    }
    // And drop them from Tim's pending feedback, or the Home cards outlive the
    // games they point at.
    const u = db.collection("users").doc(TIM);
    const snap = await u.get();
    const pf = snap.get("pending_feedback") || [];
    const alive = [];
    for (const r of pf) {
        const g = await r.get();
        if (g.exists) alive.push(r);
    }
    if (alive.length !== pf.length) {
        await u.update({ pending_feedback: alive });
    }
    console.log(`purged ${n} case game(s)\n`);
}

// ------------------------------------------------------------------ verify

async function verify() {
    const q = await db
        .collection("games")
        .where("seed_tag", "==", SEED_TAG)
        .get();
    const byCase = new Map(q.docs.map((d) => [d.get("seed_case"), d]));
    let pass = 0;
    let fail = 0;

    for (const c of CASES) {
        const d = byCase.get(c.id);
        if (!d) {
            console.log(`FAIL ${c.id}: not written`);
            fail++;
            continue;
        }
        const problems = [];
        const sp = d.get("score_proposals") || [];
        const periods = sp.length ? sp[0].periods || [] : [];
        if (periods.length !== c.expect.periods) {
            problems.push(
                `periods ${periods.length}, expected ${c.expect.periods}`
            );
        }
        const teams = (d.get("teams") || []).filter((t) => t.user_id);
        if (c.expect.filled != null && teams.length !== c.expect.filled) {
            problems.push(`filled ${teams.length}, expected ${c.expect.filled}`);
        }
        if (c.expect.guests != null) {
            const g = teams.filter((t) => t.plus_one).length;
            if (g !== c.expect.guests) {
                problems.push(`guests ${g}, expected ${c.expect.guests}`);
            }
        }
        // Padel: sets won must match, computed the way matchScore() does.
        if (c.expect.setsA != null) {
            let a = 0;
            let b = 0;
            for (const p of periods) {
                if (p.team_a > p.team_b) a++;
                else if (p.team_b > p.team_a) b++;
            }
            if (a !== c.expect.setsA || b !== c.expect.setsB) {
                problems.push(
                    `sets ${a}-${b}, expected ${c.expect.setsA}-${c.expect.setsB}`
                );
            }
        }
        // The tie-break flags must agree with the numbers that produced them.
        periods.forEach((p, i) => {
            // 7-6 is a tie-break; 7-5 is a normal set won from 5-5.
            const wasTieBreak =
                (p.team_a === 7 && p.team_b === 6) ||
                (p.team_b === 7 && p.team_a === 6);
            if (i !== 2 && p.tie_break !== wasTieBreak) {
                problems.push(
                    `set ${i + 1}: tie_break=${p.tie_break} but score ${p.team_a}-${p.team_b}`
                );
            }
            // Index 2 is a super tie-break only in a match that WENT to three
            // sets. A group playing on past a finished match stores a fourth
            // and fifth ordinary set, and its third is not a decider at all --
            // so this is asserted only when the match is exactly three long.
            if (i === 2 && periods.length === 3 && !p.super_tie_break) {
                problems.push(`set 3 is not flagged as a super tie-break`);
            }
        });

        if (problems.length) {
            console.log(`FAIL ${c.id}`);
            problems.forEach((p) => console.log(`       ${p}`));
            fail++;
        } else {
            console.log(`pass ${c.id}`);
            pass++;
        }
    }
    console.log(`\n${pass} passed, ${fail} failed of ${CASES.length}`);
    return fail === 0;
}

// --------------------------------------------------------------------- run

async function run() {
    if (VERIFY) {
        const ok = await verify();
        process.exit(ok ? 0 : 1);
    }

    const docs = CASES.map(build);
    assertGuards(docs);

    if (PURGE) {
        await purge();
        console.log("purged, nothing created.");
        process.exit(0);
    }

    console.log(`${CASES.length} case(s):\n`);
    for (const c of CASES) {
        console.log(`  ${c.id.padEnd(28)} ${c.why}`);
    }

    if (!WRITE) {
        console.log("\ndry run. re-run with --write to purge and create.");
        process.exit(0);
    }

    await purge();
    const refs = [];
    for (const g of docs) {
        const ref = await db.collection("games").add(g);
        refs.push(ref);
    }
    // DECLARE THE GOALS the cases ask for. `goals` was carried on the case and
    // written nowhere, so no case ever exercised the card's strongest line and
    // "2 buts dans la victoire" went untested all session.
    for (let i = 0; i < CASES.length; i++) {
        const g = CASES[i].goals || 0;
        if (!g) continue;
        const events = refs[i].collection("live_events");
        for (let n = 0; n < g; n++) {
            await events.add({
                type: "attribution",
                scorer_id: TIM,
                created_by: TIM,
                created_at: new Date(),
                source: "wrap_up",
            });
        }
    }

    // Every case must be reachable from Home, or none of them can be tested.
    await db
        .collection("users")
        .doc(TIM)
        .update({
            pending_feedback: admin.firestore.FieldValue.arrayUnion(...refs),
        });
    console.log(`\nwrote ${refs.length} case(s) and added them to pending_feedback`);

    const ok = await verify();
    process.exit(ok ? 0 : 1);
}

run().catch((e) => {
    console.error(e);
    process.exit(1);
});
