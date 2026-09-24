/**
 * SEED ONE PERSONA'S STORE-SCREENSHOT FIXTURES.
 *
 * Usage:
 *   node seed_store_persona.js --lang en            # dry run, prints the plan
 *   node seed_store_persona.js --lang en --write    # seed
 *   node seed_store_persona.js --purge              # remove every persona's set
 *
 * Replaces seed_store_screenshots.js, which restyled a SHARED cast of nine
 * accounts into whichever names a language needed. That design produced the
 * defect that made the first pass unusable: every frame carried Paris venues
 * because only the French variant was ever run, and the pitch was six players
 * because nine shared accounts could not fill a 5v5 roster without repeating
 * a uid.
 *
 * Here each persona owns twelve accounts of its own (create_store_personas.js)
 * and its own city, so nothing has to be restyled and nothing is shared.
 *
 * ===========================================================================
 * WHAT A STORE VIEWER MUST BELIEVE
 * ===========================================================================
 *
 * Every number on these fixtures is chosen so a person browsing the store in
 * that city thinks "that is my Tuesday", not "that is seeded data":
 *
 *   - 5v5, ten players. The format Poteau is actually for.
 *   - Kickoffs at 18:30-21:00 in that city's evening, never 2am.
 *   - Rosters 7/10 to 9/10, one FULL. Poteau games do NOT fill (40 of 4000
 *     ever reached capacity), so an all-full list would be the lie.
 *   - Prices round and local: 8-12 EUR, 10-15 USD.
 *   - Venue names a local recognises, addresses to match.
 *
 * ===========================================================================
 * WHERE THE FIXTURES PHYSICALLY SIT
 * ===========================================================================
 *
 * At the sanctioned remote venue (lib/test_game.js REMOTE_VENUE), 939km from
 * the nearest real user, and PUBLIC. Only the display strings say Paris or
 * New York. This is not cosmetic:
 *
 *   - getGamesMulti searches by RADIUS and does not filter is_test_game, so a
 *     fixture near a real person reaches their device. A Paris-anchored
 *     viewer's games list came back full of real users' games at LE FIVE
 *     Bezons and Créteil. Distance is the only real barrier.
 *   - `visibility: private` cannot be used instead, because a private game
 *     draws an unconditional padlock on its card.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
const { PERSONAS, eveningSlate, inviteSlate } = require("./lib/store_personas");
const { REMOTE_VENUE, testGame } = require("./lib/test_game");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
});

const db = admin.firestore();
const { Timestamp, GeoPoint, FieldValue } = admin.firestore;

const argv = process.argv;
const WRITE = argv.includes("--write");
const PURGE = argv.includes("--purge");
const langIdx = argv.indexOf("--lang");
const LANG = langIdx > -1 ? argv[langIdx + 1] : null;

const TAG = "store_shots_520";
const MIN = 60 * 1000;

if (!PURGE && !PERSONAS[LANG]) {
    console.error(`--lang must be one of: ${Object.keys(PERSONAS).join(", ")}`);
    process.exit(1);
}

function km(la1, lo1, la2, lo2) {
    const R = 6371;
    const dLa = ((la2 - la1) * Math.PI) / 180;
    const dLo = ((lo2 - lo1) * Math.PI) / 180;
    const a = Math.sin(dLa / 2) ** 2 +
        Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) *
        Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Everyone this persona owns, viewer first. */
async function loadCast(lang) {
    const snap = await db.collection("users").where("store_persona", "==", lang).get();
    const people = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
    const p = PERSONAS[lang];
    // THE VIEWER IS THE ANCHOR ACCOUNT, shared by every persona.
    //
    // Each persona used to own its own viewer, which meant signing out and in
    // between personas -- four chances per device for a tap to land on the
    // wrong button, and they did. switch_persona.js renames ONE account
    // instead, so the device stays signed in for the whole session.
    const anchorSnap = await db.collection("users")
        .where("store_anchor", "==", true).limit(1).get();
    let viewer;
    if (!anchorSnap.empty) {
        viewer = { uid: anchorSnap.docs[0].id, ...anchorSnap.docs[0].data() };
    } else {
        viewer = people.find((x) => x.display_name === p.viewer.display);
    }
    if (!viewer) throw new Error(`no viewer account for ${lang}`);
    const men = p.men.map((n) => people.find((x) => x.display_name === n)).filter(Boolean);
    const women = p.women.map((n) => people.find((x) => x.display_name === n)).filter(Boolean);
    if (men.length < 9) throw new Error(`${lang}: only ${men.length} men, need 9`);
    if (women.length < 2) throw new Error(`${lang}: only ${women.length} women, need 2`);
    return { viewer, men, women, all: [viewer, ...people.filter((x) => x.uid !== viewer.uid)] };
}

/**
 * `teams` with `filled` taken spots out of `max`.
 *
 * NEVER REPEATS A UID. A repeated reference IS a `+1` in this schema, so a
 * roster bigger than its pool would silently become "one player with N +1s"
 * and every capacity number on the card would lie.
 */
function roster(filled, max, people) {
    if (filled > people.length) {
        throw new Error(
            `roster(${filled}/${max}): pool holds ${people.length}. ` +
            `A repeated uid is a +1 -- grow the pool, never repeat.`
        );
    }
    const spots = [];
    for (let i = 0; i < max; i++) {
        const taken = i < filled;
        spots.push({
            user_id: taken ? people[i].uid : "",
            status: taken ? "confirmed" : "open",
            team_side: i % 2 === 0 ? "team_a" : "team_b",
            plus_one: false,
        });
    }
    return spots;
}

/**
 * THE PLAN.
 *
 * Fill levels are deliberately varied and mostly NOT full: Poteau games do not
 * fill (40 of 4000 ever reached capacity), so a list of full games would be
 * the least believable thing on the screen. One FULL card gives the list
 * texture without claiming the app is always packed.
 */
function buildPlan(p, slate, inv) {
    const v = p.venues;
    const eur = p.currency === "EUR";
    const price = (a, b) => (eur ? a : b);

    return [
        // --- the games list, today ------------------------------------------
        // First card is the one screen 3 opens: joinable, one spot left.
        { key: "sheet_soccer", screens: "2,3", sport: "soccer", date: slate[0],
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_padel_1", screens: "2", sport: "padel", date: slate[1],
          duration: 90, max: 4, filled: 3, viewerJoined: false,
          venue: v.padelA, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_soccer_full", screens: "2", sport: "soccer", date: slate[2],
          duration: 60, max: 10, filled: 10, viewerJoined: false,
          venue: v.soccerB, price: price(10, 14),
          levelDeltas: ["five_six"] },

        { key: "list_soccer_2", screens: "2", sport: "soccer", date: slate[3],
          duration: 60, max: 10, filled: 7, viewerJoined: false,
          venue: v.soccerC, price: price(8, 12),
          levelDeltas: ["three_four", "five_six"] },

        { key: "list_padel_2", screens: "2", sport: "padel", date: slate[4],
          duration: 90, max: 4, filled: 2, viewerJoined: false,
          venue: v.padelB, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_soccer_3", screens: "2", sport: "soccer", date: slate[5],
          duration: 60, max: 10, filled: 8, viewerJoined: false,
          venue: v.soccerD, price: price(8, 10),
          levelDeltas: ["five_six", "seven_eight"] },

        // --- invitations (screen 1) ------------------------------------------
        // Tonight and tomorrow, nearly full, at least one padel.
        { key: "invite_soccer", screens: "1", sport: "soccer", date: inv[0],
          duration: 60, max: 10, filled: 8, viewerJoined: false,
          venue: v.soccerB, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"], invitation: true },

        { key: "invite_padel", screens: "1", sport: "padel",
          date: new Date(inv[1].getTime() + 24 * 60 * MIN),
          duration: 90, max: 4, filled: 3, viewerJoined: false,
          venue: v.padelA, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"], invitation: true },

        { key: "invite_soccer_2", screens: "1", sport: "soccer",
          date: new Date(inv[2].getTime() + 24 * 60 * MIN),
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerC, price: price(10, 14),
          levelDeltas: ["five_six"], invitation: true },

        // --- Live, mid-match (screen 4) --------------------------------------
        //
        // Home only lists games whose kickoff is within the last 30 minutes
        // (nowMinus30Min), so these sit at -18 and -22, and they carry
        // `poteau_live` -- an opt-in cohort flag that defaults to false, which
        // means a fixture without it renders no Live UI at all.
        { key: "live_soccer", screens: "4", sport: "soccer",
          date: new Date(Date.now() - 18 * MIN),
          duration: 60, max: 10, filled: 10, viewerJoined: true,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"],
          live: { sport: "soccer" } },

        { key: "live_padel", screens: "4", sport: "padel",
          date: new Date(Date.now() - 22 * MIN),
          duration: 90, max: 4, filled: 4, viewerJoined: true,
          venue: v.padelA, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"],
          live: { sport: "padel" } },

        // --- played, for the wrap-up and share card (screen 5) ----------------
        // Ends 5 minutes ago, so the wrap-up card is on Home.
        { key: "share_played", screens: "5", sport: "soccer",
          date: new Date(Date.now() - 25 * MIN),
          duration: 20, max: 10, filled: 10, viewerJoined: true,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"],
          played: { periods: [{ team_a: 5, team_b: 3 }], viewerGoals: 2 } },
    ];
}

/** Soccer goals as real appended events. Never a stored score: the board folds
 *  these exactly as it folds a real match. */
function soccerLiveEvents(kickoff, scorers) {
    const out = [];
    for (const g of scorers) {
        const at = new Date(kickoff.getTime() + g.min * MIN);
        const cid = `seed_${TAG}_${g.min}`;
        out.push({ type: "point", side: g.side, created_by: g.scorer,
            created_at: Timestamp.fromDate(at), client_at: Timestamp.fromDate(at),
            client_event_id: cid });
        out.push({ type: "attribution", attributes: cid, scorer_id: g.scorer,
            created_by: g.scorer,
            created_at: Timestamp.fromDate(new Date(at.getTime() + 5000)),
            client_at: Timestamp.fromDate(new Date(at.getTime() + 5000)),
            client_event_id: `${cid}_attr` });
    }
    return out;
}

/** Padel points reaching set 1 won 6-4, set 2 at 3-2, point 30-15. Built by
 *  construction; the seeder verifies it against the app's own fold. */
function padelPattern() {
    let p = "";
    const game = (s) => { p += s.repeat(4); };
    for (let i = 0; i < 4; i++) { game("a"); game("b"); }
    game("a"); game("a");
    for (let i = 0; i < 2; i++) { game("a"); game("b"); }
    game("a");
    p += "aab";
    return p;
}

function padelEvents(pattern, kickoff, by) {
    return pattern.split("").map((c, i) => {
        const at = new Date(kickoff.getTime() + (i + 1) * 20000);
        return { type: "point", side: c === "a" ? "team_a" : "team_b",
            created_by: by, created_at: Timestamp.fromDate(at),
            client_at: Timestamp.fromDate(at),
            client_event_id: `seed-${TAG}-${String(i).padStart(3, "0")}` };
    });
}

async function purge() {
    const games = await db.collection("games").where("seed_tag", "==", TAG).get();
    let n = 0;
    for (const d of games.docs) {
        const ev = await d.ref.collection("live_events").get();
        const b = db.batch();
        ev.docs.forEach((e) => b.delete(e.ref));
        b.delete(d.ref);
        await b.commit();
        n += 1;
    }
    const inv = await db.collection("game_invitations").where("seed_tag", "==", TAG).get();
    for (let i = 0; i < inv.docs.length; i += 400) {
        const b = db.batch();
        inv.docs.slice(i, i + 400).forEach((x) => b.delete(x.ref));
        await b.commit();
    }
    // Detach every persona account from the games that just went away.
    for (const lang of Object.keys(PERSONAS)) {
        const s = await db.collection("users").where("store_persona", "==", lang).get();
        for (const d of s.docs) await d.ref.update({ games: [] });
    }
    console.log(`purged ${n} game(s), ${inv.size} invitation(s)`);
    return n;
}

/** Guard: no REAL user may be within browsing range of where we seed. */
async function assertNobodyNearby() {
    const snap = await db.collection("users")
        .where("last_location", "!=", null)
        .select("last_location", "is_test_account", "display_name").get();
    const near = [];
    snap.forEach((d) => {
        const u = d.data();
        if (u.is_test_account === true) return;
        const L = u.last_location;
        if (!L) return;
        const dist = km(L.latitude, L.longitude, REMOTE_VENUE.lat, REMOTE_VENUE.lng);
        if (dist <= 50) near.push(`${u.display_name || d.id} (${Math.round(dist)}km)`);
    });
    if (near.length) {
        throw new Error(
            `${near.length} REAL user(s) within 50km of the seed venue: ` +
            `${near.slice(0, 5).join(", ")}. Refusing to seed.`
        );
    }
    return snap.size;
}

async function run() {
    if (PURGE) { await purge(); process.exit(0); }

    const p = PERSONAS[LANG];
    const slate = eveningSlate();
    const inv = inviteSlate(slate[0]);
    const plan = buildPlan(p, slate, inv);
    const cast = await loadCast(LANG);

    const pad = (n) => String(n).padStart(2, "0");
    const when = (d) =>
        `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

    console.log(
        `\nSTORE FIXTURES — ${LANG.toUpperCase()} / ${p.city} — ` +
        `${p.currency} — ${p.clock24h ? "24h" : "AM/PM"} — ` +
        `${WRITE ? "WRITING" : "DRY RUN"}\n`
    );

    const checked = await assertNobodyNearby();
    console.log(`  guard: no real user within 50km (checked ${checked} located accounts)`);
    console.log(`  cast : ${cast.men.length} men + ${cast.women.length} women + viewer ${cast.viewer.display_name}`);
    console.log(`  slate: ${when(slate[0])} to ${when(slate[5])}\n`);

    for (const g of plan) {
        console.log(
            `  [${g.screens}] ${when(g.date)}  ${String(g.filled).padStart(2)}/${g.max}  ` +
            `${g.sport.padEnd(6)} ${g.venue.centre}`
        );
    }

    if (!WRITE) {
        console.log(`\nDRY RUN — nothing written. Re-run with --write.\n`);
        process.exit(0);
    }

    await purge();

    const created = [];
    for (const g of plan) {
        // Padel is mixed: two women lead the court, then men. Football is the
        // men's pool, viewer included when he plays.
        // Football: nine men plus the viewer is exactly ten, which is a full
        // 5v5 pitch. The viewer leads when he plays; when he does not, he goes
        // LAST so a 9/10 roster is the nine other men and the empty spot is
        // his to take -- which is what screen 3 is selling.
        const pool = g.sport === "padel"
            ? [cast.women[0], cast.men[0], cast.women[1], cast.men[1]]
            : (g.viewerJoined
                ? [cast.viewer, ...cast.men]
                : [...cast.men, cast.viewer]);
        const teams = roster(g.filled, g.max, pool);
        const attendees = teams.filter((t) => t.user_id)
            .map((t) => db.collection("users").doc(t.user_id));
        const organizer = pool[0].uid;

        const doc = testGame({
            seed_tag: TAG,
            store_persona: LANG,
            date: Timestamp.fromDate(g.date),
            end_time: Timestamp.fromDate(new Date(g.date.getTime() + g.duration * MIN)),
            duration: g.duration,
            status: g.played ? "played" : "published",
            organizer,
            location: new GeoPoint(REMOTE_VENUE.lat, REMOTE_VENUE.lng),
            max_players: g.max,
            teams, attendees,
            interested: [], messages: [], outsiders: [],
            price: g.price,
            price_undiscounted: g.price,
            currency: p.currency,
            payment_type: "on-site",
            sport: g.sport,
            type: g.sport === "padel" ? "2v2" : `${g.max / 2}v${g.max / 2}`,
            level_deltas: g.levelDeltas || [],
            gold_exclusive: false,
            level: 3,
            mood: "fun",
            time_zone: p.timeZone,
            reservation_name: g.key,
            description: "",
            created_on: FieldValue.serverTimestamp(),
        }, { venue: REMOTE_VENUE, public: true });

        // The DISPLAY strings: the only geography a screenshot ever shows.
        doc.centre = g.venue.centre;
        doc.address = g.venue.address;

        if (g.played) {
            const at = Timestamp.fromDate(new Date(g.date.getTime() + g.duration * MIN));
            const agreed = pool.slice(0, 4).map((x) => x.uid);
            doc.score_proposals = [{ periods: g.played.periods, proposed_by: organizer,
                proposed_at: at, agreed_by: agreed }];
            doc.result_proposals = [{ winning_side: "team_a", is_draw: false,
                proposed_by: organizer, proposed_at: at, agreed_by: agreed }];
        }

        if (g.live) {
            // poteau_live is an OPT-IN cohort flag defaulting to false: without
            // it the game renders no Live UI however correct everything else is.
            doc.poteau_live = true;
            doc.live_teams_confirmed_at = Timestamp.fromDate(new Date(g.date.getTime() - 5 * MIN));
            doc.live_opened_at = Timestamp.fromDate(new Date(g.date.getTime() - 5 * MIN));
        }

        const ref = await db.collection("games").add(doc);
        created.push({ key: g.key, ref, viewerOn: teams.some((t) => t.user_id === cast.viewer.uid) });

        if (g.live && g.live.sport === "soccer") {
            const evs = soccerLiveEvents(g.date, [
                { min: 8, side: "team_a", scorer: pool[0].uid },
                { min: 21, side: "team_b", scorer: pool[1].uid },
                { min: 29, side: "team_a", scorer: pool[2].uid },
                { min: 34, side: "team_b", scorer: pool[3].uid },
                { min: 38, side: "team_a", scorer: pool[0].uid },
            ]);
            for (const e of evs) await ref.collection("live_events").add(e);
        }
        if (g.live && g.live.sport === "padel") {
            for (const e of padelEvents(padelPattern(), g.date, pool[0].uid)) {
                await ref.collection("live_events").add(e);
            }
        }

        // THE WRAP-UP SHARE CARD READS GOALS FROM live_events, NOT A FIELD.
        //
        // The card is a two-column roster with the scoreline and each player's
        // declared goals beside their name. Those goals are `attribution`
        // events, written by the goals step of the wrap-up; a played game
        // without them renders a card with an empty goals column.
        //
        // Seeding them directly gives the same card the flow produces, without
        // walking five steps of UI per language.
        if (g.played) {
            const periods = g.played.periods[0];
            const goals = [];
            // Team A scored 5: the viewer takes 2, three team-mates one each.
            const teamA = pool.filter((_, i) => i % 2 === 0);
            const teamB = pool.filter((_, i) => i % 2 === 1);
            const mk = (scorer, side, min) => {
                const at = new Date(g.date.getTime() + min * MIN);
                const cid = `seed_${TAG}_wrap_${side}_${min}`;
                goals.push({ type: "point", side, created_by: scorer,
                    created_at: Timestamp.fromDate(at), client_at: Timestamp.fromDate(at),
                    client_event_id: cid });
                goals.push({ type: "attribution", attributes: cid, scorer_id: scorer,
                    created_by: scorer,
                    created_at: Timestamp.fromDate(new Date(at.getTime() + 3000)),
                    client_at: Timestamp.fromDate(new Date(at.getTime() + 3000)),
                    client_event_id: `${cid}_attr` });
            };
            let m = 3;
            for (let i = 0; i < periods.team_a; i++) {
                // The viewer scores the first two, so his own card shows 2.
                const scorer = i < g.played.viewerGoals
                    ? cast.viewer.uid
                    : teamA[(i % teamA.length)].uid;
                mk(scorer, "team_a", m); m += 3;
            }
            for (let i = 0; i < periods.team_b; i++) {
                mk(teamB[i % teamB.length].uid, "team_b", m); m += 3;
            }
            for (const e of goals) await ref.collection("live_events").add(e);
            // The card only renders a settled game, and the flow marks it so.
            await ref.update({
                live_teams_confirmed_at: Timestamp.fromDate(new Date(g.date.getTime() - 5 * MIN)),
                live_opened_at: Timestamp.fromDate(new Date(g.date.getTime() - 5 * MIN)),
                poteau_live: true,
            });
        }

        if (g.invitation) {
            await db.collection("game_invitations").add({
                seed_tag: TAG,
                inviter: db.collection("users").doc(organizer),
                invitee: db.collection("users").doc(cast.viewer.uid),
                game: ref,
                game_date: Timestamp.fromDate(g.date),
                status: "pending",
                created: Timestamp.fromDate(new Date(Date.now() - 20 * MIN)),
            });
        }
    }

    // "Tes matchs" renders from users.games, NOT from the rosters.
    const mine = created.filter((c) => c.viewerOn).map((c) => c.ref);
    // The wrap-up card on Home renders from `pending_feedback`, not from the
    // game's status: a played game the viewer has already given feedback on
    // shows nothing. Screen 5 depends on this.
    // pending_feedback is left EMPTY on purpose.
    //
    // Home shows one of two cards for a finished game. With the game in
    // pending_feedback it shows "Alors, ce foot ?", which opens the four-step
    // feedback FLOW -- and a capture then lands on step one, a dark question
    // screen, not the share card. With feedback already given it shows
    // "Voir ta carte du match", which opens the card directly.
    //
    // The card is what screen 5 is for, so the fixture is seeded as a game the
    // viewer has already wrapped up.
    await db.collection("users").doc(cast.viewer.uid).update({
        games: mine,
        pending_feedback: [],
        // Friends with the whole cast: harmless now the games are public, and
        // it keeps the roster faces on the invitation cards.
        friends: cast.all.filter((x) => x.uid !== cast.viewer.uid)
            .map((x) => db.collection("users").doc(x.uid)),
    });

    // Verify what was WRITTEN, not what was planned.
    const check = await db.collection("games").where("seed_tag", "==", TAG).get();
    const bad = [];
    check.forEach((d) => {
        const x = d.data();
        if (x.is_test_game !== true) bad.push(`${d.id} unflagged`);
        if (x.visibility !== "public") bad.push(`${d.id} visibility=${x.visibility}`);
        if (x.place_id !== REMOTE_VENUE.placeId) bad.push(`${d.id} wrong place_id`);
    });
    if (bad.length) {
        console.error("\n!! GUARD VIOLATION:\n  " + bad.join("\n  "));
        process.exit(1);
    }

    console.log(
        `\nseeded ${created.length} game(s) for ${LANG.toUpperCase()} / ${p.city}, ` +
        `viewer on ${mine.length}\n`
    );
    process.exit(0);
}

run().catch((e) => { console.error("\nFAILED:", e.message); process.exit(1); });
