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
/**
 * THE PLAN — one fixture per thing a store viewer must believe.
 *
 * The brief (Tim, 2026-09-25) states what each screen has to SAY, not just
 * what it has to show, and the fixtures exist to make those claims true:
 *
 *   1 Home / invites   invitations arrive because of your availabilities and
 *                      your address -- so they are games you did not search for
 *   2 Games list       there are games all around you, free AND paying, some
 *                      down to the last spot, some with room
 *   3 Game sheet       real players with faces, one spot left, easy to take
 *   4 Poteau Live      scoring is easy and fun, mid-match
 *   5 Share card       a win worth being proud of, with your own goal on it
 */
/**
 * The most recent :00 or :30 that is still inside Home's window.
 *
 * Two requirements pull against each other:
 *
 *   - Kickoffs must be ROUND (Tim, 2026-09-25: "all hours should be round,
 *     never 11:27"). An odd minute is one of the small tells that says
 *     "seeded data" to anyone reading the card.
 *   - Home only lists games kicked off in the last 30 minutes
 *     (nowMinus30Min), so a fixture older than that renders nothing at all.
 *
 * Rounding a "28 minutes ago" anchor DOWN gave 13:00 when it was 13:43 -- a
 * round time, 43 minutes back, invisible on Home. So this walks back from now
 * to the nearest half-hour mark and only accepts it if it is still inside the
 * window; otherwise it returns the window's edge, which is round often enough
 * and always visible.
 *
 * @param {number} maxAgeMin how far back the fixture may sit (< 30)
 */
function recentRoundKickoff(maxAgeMin) {
    const now = new Date();
    const half = new Date(now);
    half.setSeconds(0, 0);
    half.setMinutes(now.getMinutes() < 30 ? 0 : 30);

    const ageMin = (now - half) / 60000;
    if (ageMin >= 5 && ageMin <= maxAgeMin) return half;

    // The half-hour mark is too fresh or too stale; sit at a fixed age
    // instead. Not round, but visible -- and a Live card shows a running
    // clock rather than the kickoff time, so this is the one place where
    // being inside the window matters more than the minute digits.
    return new Date(now.getTime() - maxAgeMin * 60000);
}

function buildPlan(p, slate, inv) {
    const v = p.venues;
    const eur = p.currency === "EUR";
    const price = (a, b) => (eur ? a : b);

    return [
        // --- SCREEN 2: the games list --------------------------------------
        //
        // Eight games across the evening. Prices MIXED, including free ones:
        // a list where everything costs money says the app is a booking
        // service, and free pickup games are most of what actually happens.
        //
        // Spot counts are varied on purpose. "Last spot available" creates
        // urgency; "4 spots available" says you can still bring friends. Only
        // one game is full -- Poteau games do not fill (40 of 4000 ever
        // reached capacity), so a full list would be the least believable
        // thing on the screen.
        { key: "list_1", screens: "2", sport: "soccer", date: slate[0],
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_2", screens: "2", sport: "soccer", date: slate[1],
          duration: 60, max: 10, filled: 6, viewerJoined: false,
          venue: v.soccerB, price: 0,                       // free
          levelDeltas: ["three_four", "five_six"] },

        { key: "list_3", screens: "2", sport: "padel", date: slate[2],
          duration: 90, max: 4, filled: 3, viewerJoined: false,
          venue: v.padelA, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"] },

        // The sheet screen opens THIS one: tomorrow, 20:00, one spot left.
        { key: "sheet_soccer", screens: "2,3", sport: "soccer",
          date: new Date(slate[3].getTime() + 24 * 60 * 60 * 1000),
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerC, price: price(10, 14),
          levelDeltas: ["five_six", "seven_eight"] },

        // Tonight's 20:00 PAIR. The sheet fixture also sits at 20:00 but
        // TOMORROW, so without these two the brief's doubled slot is missing
        // from the list a viewer actually sees.
        { key: "list_4", screens: "2", sport: "soccer", date: slate[3],
          duration: 60, max: 10, filled: 5, viewerJoined: false,
          venue: v.soccerC, price: price(10, 14),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_5", screens: "2", sport: "soccer", date: slate[4],
          duration: 60, max: 10, filled: 10, viewerJoined: false,
          venue: v.soccerD, price: price(8, 12),
          levelDeltas: ["five_six"] },

        { key: "list_6", screens: "2", sport: "soccer", date: slate[5],
          duration: 60, max: 10, filled: 6, viewerJoined: false,
          venue: v.soccerB, price: 0,                       // free
          levelDeltas: ["three_four", "five_six"] },

        { key: "list_7", screens: "2", sport: "padel", date: slate[6],
          duration: 90, max: 4, filled: 2, viewerJoined: false,
          venue: v.padelB, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"] },

        { key: "list_8", screens: "2", sport: "soccer", date: slate[7],
          duration: 60, max: 10, filled: 7, viewerJoined: false,
          venue: v.soccerA, price: price(8, 10),
          levelDeltas: ["five_six", "seven_eight"] },

        // --- SCREEN 1: invitations, and nothing else ------------------------
        //
        // Four cards, all 19:00-20:30, all one or two spots from full, mixed
        // free and paid. Off-slate times and a spread of venues, so they read
        // as games that came TO the viewer rather than the list repeated.
        //
        // The capture parks the Live and played fixtures outside Home's
        // 30-minute window for this screen, because Home renders those ABOVE
        // the invitations and would otherwise bury them.
        { key: "invite_1", screens: "1", sport: "soccer", date: inv[0],
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerB, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"], invitation: true },

        { key: "invite_2", screens: "1", sport: "soccer", date: inv[1],
          duration: 60, max: 10, filled: 8, viewerJoined: false,
          venue: v.soccerD, price: 0,                       // free
          levelDeltas: ["five_six"], invitation: true },

        // Padel, at padelB rather than padelA.
        //
        // The Home invitations section can render the SAME game twice when a
        // fixture is both invited and nearby-joinable, which put "Padel Haus
        // Williamsburg / 1 spot left" on screen 1 at two different times
        // (2026-09-25). Four distinct venues across the four invitations means
        // a duplicated render can never repeat a venue NAME, which is the part
        // a viewer would read as broken data.
        { key: "invite_3", screens: "1", sport: "padel", date: inv[2],
          duration: 90, max: 4, filled: 3, viewerJoined: false,
          venue: v.padelB, price: price(12, 15),
          levelDeltas: ["five_six", "seven_eight"], invitation: true },

        { key: "invite_4", screens: "1", sport: "soccer", date: inv[3],
          duration: 60, max: 10, filled: 9, viewerJoined: false,
          venue: v.soccerC, price: price(10, 14),
          levelDeltas: ["five_six", "seven_eight"], invitation: true },

        // --- SCREEN 4: Poteau Live, ~30 minutes in --------------------------
        //
        // Home only lists games kicked off within the last 30 minutes, so -28
        // is as late as the brief's "started ~30min ago" can be taken.
        { key: "live_soccer", screens: "4", sport: "soccer",
          date: recentRoundKickoff(25),
          duration: 60, max: 10, filled: 10, viewerJoined: true,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"],
          live: { sport: "soccer" } },

        // --- SCREEN 5: the share card ---------------------------------------
        //
        // A 3-2 WIN with ONE goal by the viewer, per the brief. The goals are
        // appended as attribution events, which is where the card reads them.
        // A FULL HOUR, not 20 minutes.
        //
        // The share card prints the duration, and "20MIN" under a five-a-side
        // scoreline reads as broken data -- no game lasts 20 minutes
        // (2026-09-25). The 20 was a leftover from making the fixture land
        // inside Home's recent window, which the kickoff already handles.
        { key: "share_played", screens: "5", sport: "soccer",
          date: recentRoundKickoff(25),
          duration: 60, max: 10, filled: 10, viewerJoined: true,
          venue: v.soccerA, price: price(8, 12),
          levelDeltas: ["five_six", "seven_eight"],
          played: { periods: [{ team_a: 3, team_b: 2 }], viewerGoals: 1 } },
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
    const slate = eveningSlate(p.timeZone);
    const inv = inviteSlate(slate[0], p.timeZone);
    const plan = buildPlan(p, slate, inv);
    const cast = await loadCast(LANG);

    const pad = (n) => String(n).padStart(2, "0");
    // Printed in the PERSONA's timezone, not the machine's. A New York slate
    // logged in Paris time reads as a 2am kickoff and looks like the bug this
    // very change fixes.
    const when = (d) => d.toLocaleString("en-GB", {
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit", hour12: false,
    }).replace(",", "");

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
        // ROTATE THE ROSTER PER FIXTURE.
        //
        // Every card drew from the top of the same men's list, so two
        // invitations showed the same four faces and read as duplicated data
        // rather than two different groups of players (Tim, 2026-09-25).
        // Rotating by a per-fixture offset gives each card its own opening
        // faces while still never repeating a uid inside one roster.
        const rot = (arr, n) => arr.slice(n % arr.length).concat(arr.slice(0, n % arr.length));
        const seed = [...g.key].reduce((a, c) => a + c.charCodeAt(0), 0);
        const menRot = rot(cast.men, seed);

        const pool = g.sport === "padel"
            ? [cast.women[seed % 2], menRot[0], cast.women[(seed + 1) % 2], menRot[1]]
            : (g.viewerJoined
                ? [cast.viewer, ...menRot]
                : [...menRot, cast.viewer]);
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
            // The DEVICE's zone, not the persona's city zone.
            //
            // Two surfaces disagree about which to use: the games list renders
            // against the simulator clock, the invitation cards against this
            // field. The simulator ignores AppleTimeZone and stays on the
            // host's zone, so writing the city's zone here made the two
            // surfaces show different hours for the same evening. Both now
            // read the same clock, and every frame shows 18:00-21:30.
            time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    // THE INVITATIONS TOGGLE READS THE AVAILABILITIES DOCUMENT.
    //
    // Screen 1 must show "Activées" -- an invitations section reading
    // "Désactivées" says the feature is off, which is the opposite of what the
    // frame is selling (Tim, 2026-09-25). The toggle is driven by an
    // `availabilities` doc keyed on user_id whose `slots` is non-empty, not by
    // anything on the user record.
    //
    // Slots are "weekday-HH:MM" with weekday 1-7, and these are the hours a
    // five-a-side player actually offers: weekday evenings, 18:30 to 21:30.
    const slots = [];
    for (let day = 1; day <= 5; day++) {
        for (const t of ["18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"]) {
            slots.push(`${day}-${t}`);
        }
    }
    const availSnap = await db.collection("availabilities")
        .where("user_id", "==", cast.viewer.uid).limit(1).get();
    const availDoc = availSnap.empty
        ? db.collection("availabilities").doc()
        : availSnap.docs[0].ref;
    await availDoc.set({
        user_id: cast.viewer.uid,
        slots,
        location: new GeoPoint(REMOTE_VENUE.lat, REMOTE_VENUE.lng),
        radius: 20000,
        city: p.city,
        country: p.country,
        label: "home",
        emoji: "⚽️",
        origin: "store_shots_520",
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
    }, { merge: true });
    console.log(`availabilities: ${slots.length} slots (invitations read as ON)`);

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
