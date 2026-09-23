/**
 * STORE SCREENSHOT FIXTURES — 5.2.0 (STORE_SCREENSHOTS_5.2.0.md).
 *
 * Seeds the five store screens for a capture session, in two cast variants
 * (`fr` and `intl`), then puts everything back. Read the brief first; this
 * file implements it, and documents the two places it deliberately does not.
 *
 * Usage:
 *   node seed_store_screenshots.js --cast fr             # dry run, prints plan
 *   node seed_store_screenshots.js --cast fr --write     # seed
 *   node seed_store_screenshots.js --cast intl --write   # reseed, other cast
 *   node seed_store_screenshots.js --purge               # remove THIS tag only
 *   node seed_store_screenshots.js --restore             # undo the cast restyle
 *
 * ============================================================================
 * TWO DEVIATIONS FROM THE BRIEF, BOTH DELIBERATE (Tim, 2026-09-22)
 * ============================================================================
 *
 * The brief's §3 asks for PUBLIC games at KINSHASA coordinates. Both requests
 * conflict with `lib/test_game.js`, which applies `visibility: "private"` and
 * the Dole venue AFTER the caller's fields precisely so that no seeder can
 * argue with them. That guard exists because on 2026-08-17 a sibling seeder
 * wrote public games to LE FIVE Paris 17 and a real player joined one within
 * 35 minutes; deleting the seed then deleted a game somebody had signed up
 * for. Editing the guard to get a screenshot would reopen exactly that hole.
 *
 * Neither deviation costs the screenshot anything:
 *
 *   1. PUBLIC -> PRIVATE + FRIENDSHIP. The brief wants public games only
 *      because private ones render at 0.5 opacity with a badge in the games
 *      list. But that dimming is conditional (game_list_widget.dart ~l.269):
 *
 *          visibility == 'private'
 *            && !players.contains(currentUserUid)
 *            && !friends.contains(organizer)     <- this one
 *
 *      So a PRIVATE game whose organizer is a friend of the viewer renders at
 *      full opacity, with no badge and no snackbar on tap. We therefore
 *      befriend the viewer to every seeded organizer instead of going public.
 *      Identical pixels, guard intact, and `friends` is already in the backup
 *      set so it reverts with --restore. The brief's own §1 says to fix the
 *      DATA rather than the app; this is that.
 *
 *   2. KINSHASA -> DOLE COORDINATES, CUSTOM DISPLAY NAMES. A screenshot only
 *      ever shows `centre` and `address`. The coordinates behind them are
 *      invisible. So the fixtures sit at the sanctioned test venue's
 *      coordinates and place_id, and only the DISPLAY strings vary per cast.
 *      Kinshasa is equally safe in principle, but reaching it means relaxing
 *      a shared guard that eleven seeders depend on, for zero visible gain.
 *
 * Everything else in §3 is honoured as written: every game `is_test_game`,
 * tagged, test accounts only, no Tim, purge scoped to this tag alone.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS SCRIPT WRITES `users.stats` BY HAND
 * ----------------------------------------------------------------------------
 *
 * Screen 5 needs a populated profile, and `recomputeUserStats` deliberately
 * EXCLUDES `is_test_game` games -- so no amount of seeding will produce a stat
 * block through the real path. The block is therefore written directly, in the
 * exact shape of `emptyBlock()` in gen2/recomputeUserStats.js, respecting the
 * nesting invariants that function asserts (spec 3.1):
 *
 *     games_with_score <= games_with_result <= games_played
 *     wins + draws + losses == games_with_result
 *     matches_won <= matches_with_result, sets_won <= sets_played
 *
 * This is acceptable ONLY because every account involved is an
 * `is_test_account`: no real person's profile is touched, and the prior value
 * is backed up and restored. A real user's stats must never be written this
 * way -- recompute is the only write path.
 *
 * ----------------------------------------------------------------------------
 * PURGE IS TAG-SCOPED, ON PURPOSE
 * ----------------------------------------------------------------------------
 *
 * `lib/test_game.js` argues that a purge should select on `is_test_game` alone,
 * so seeders cannot accumulate each other's litter. That is right for the
 * general case and wrong for this one: a capture session runs for hours
 * alongside other work, and a broad purge mid-session would delete the set
 * being photographed. The brief calls this out explicitly. So this script
 * deletes only its own `seed_tag`, and never runs another seeder's purge.
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

const {
    TEST_VENUE,
    testGame,
    assertTestRoster,
    purgeTestGames: _unusedBroadPurge, // deliberately NOT used -- see header
} = require("./lib/test_game");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
});

const db = admin.firestore();
const { Timestamp, GeoPoint, FieldValue } = admin.firestore;

const WRITE = process.argv.includes("--write");
const PURGE = process.argv.includes("--purge");
const RESTORE = process.argv.includes("--restore");

const castArgIndex = process.argv.indexOf("--cast");
const CAST = castArgIndex > -1 ? process.argv[castArgIndex + 1] : "fr";
if (!["fr", "intl"].includes(CAST)) {
    console.error(`--cast must be 'fr' or 'intl' (got '${CAST}')`);
    process.exit(1);
}

/**
 * THE CAPTURE MATRIX — which cast each language is photographed from.
 *
 * Two axes that do NOT line up one-to-one, which is the whole reason this is
 * written down rather than remembered:
 *
 *   - NAMES/VENUES: French names and real Paris centres, or neutral
 *     international ones.
 *   - CURRENCY: EUR renders "8€" (symbol after); USD renders "$8" (before).
 *     A different width in the price pill, so it cannot be swapped in post.
 *
 *   lang | cast | currency | why
 *   -----|------|----------|----------------------------------------------
 *   fr   | fr   | EUR      | France
 *   it   | fr   | EUR      | Eurozone, so it takes the EUR pass -- only the
 *        |      |          | app language differs, NOT the cast or venues
 *   en   | intl | USD      | US/UK/AU storefronts
 *   es   | intl | USD      | American Spanish for now, not Spain
 *
 * So IT is captured during the `fr --write` pass with the app switched to
 * Italian. Its venue names stay the French ones, which is correct: an Italian
 * user browsing sees whatever is near them, and the store frame only has to
 * look plausible, not geographically Italian.
 */
const CAPTURE_MATRIX = {
    fr: { cast: "fr", currency: "EUR" },
    it: { cast: "fr", currency: "EUR" },
    en: { cast: "intl", currency: "USD" },
    es: { cast: "intl", currency: "USD" },
};

/** The cleanup key. Scoped purge selects on this and nothing else. */
const TAG = "store_shots_520";
const BACKUP_FIELD = "store_shots_backup";
const MIN = 60 * 1000;

/** Paris, used only to prove nothing is seeded near it. */
const PARIS = { lat: 48.8566, lng: 2.3522 };
const MIN_KM_FROM_PARIS = 100;

// ---------------------------------------------------------------------------
// The cast. Nine non-pro test accounts; the two `pro` accounts are excluded
// deliberately (a pro on a player roster misrepresents the fixture).
//
// Sophie is the VIEWER on every screen. Tim's account is never used.
// ---------------------------------------------------------------------------
const SOPHIE = "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2"; // the viewer
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2";
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";
const LIAM = "Go2YXYj9FFW6xG28HZNBcrDkIJV2";
const TODD = "xz7cm07tVlZkt71QsLdmeTSCPYI3";
const SPARE = "FkWN1YsfFtP5PwTCxBEpZ9NpMS23";
const MARC = "hQmClsn4bFU79IvwqTJuYrZdOg63";

/**
 * THE CAST IS SPLIT BY SPORT, NOT ONE FLAT POOL (Tim, 2026-09-23).
 *
 * The composition brief is specific, and it is about how Poteau presents
 * itself rather than about the data:
 *
 *   - 7 men, 2 women.
 *   - The two women appear on PADEL ONLY. French amateur 5-a-side football is
 *     overwhelmingly male and a mixed football roster would read as staged;
 *     padel is genuinely mixed, so that is where the women go.
 *   - The FR cast carries 1-2 North African names, which is representative of
 *     Paris-region amateur football -- and those are FOOTBALL names, never
 *     padel ones.
 *
 * Consequences for the arithmetic, which is now the binding constraint:
 *
 *   football pool = 7 men + the viewer (also male) = 8 players maximum
 *   padel pool    = 2 women + 2 men               = 4 players maximum
 *
 * A padel game is 4 players, so the padel pool is exactly one full game and
 * every padel fixture is a slice of it. Football therefore cannot exceed 8,
 * which is why the 9- and 10-a-side fixtures below were resized: a roster
 * larger than its pool can only be filled by repeating a uid, and a repeated
 * uid IS a +1 in this schema, so every capacity number would silently lie.
 *
 * MEN_PADEL is drawn from the football men on purpose. A player who appears on
 * both a football and a padel fixture is not a mistake -- Poteau users play
 * both, `users.sports` holds a list, and the two screens are never on screen
 * together anyway.
 */
// There are exactly NINE non-pro test accounts in the project -- verified
// 2026-09-23, the other two are `type: "pro"` and deliberately excluded. So
// the 7/2 split uses every available account and there is no spare. Which uid
// carries which gender is arbitrary (they are all flat 5.0 fixtures today);
// LUCIA and MARC were picked simply because nothing else depends on them.
// SOPHIE is the viewer and is male in both casts (Léo M. / Alex R.), so he
// counts toward the seven men rather than being an eighth person.
const MEN = [SOPHIE, GINA, MARCO, NOAH, LIAM, TODD, SPARE];
const WOMEN = [LUCIA, MARC];
const EVERYONE = [...MEN, ...WOMEN];

/** Football: all seven men, the viewer among them. Seven, and no more. */
const FOOTBALL_POOL = [...MEN];

/**
 * Padel: the two women FIRST, so a 2- or 3-player padel fixture shows them
 * rather than filling with men and burying the point of the split.
 *
 * The men here are MEN[1] and MEN[2], NOT MEN[0]: MEN[0] is the viewer, and a
 * padel court seats four. Putting him on it would take a seat from one of the
 * two women on the only surface where they appear.
 */
const PADEL_POOL = [...WOMEN, MEN[1], MEN[2]];

/** The pool a fixture draws from, given its sport and whether the viewer
 *  (male) is on it. The viewer never stands on a padel fixture: he would take
 *  a seat from one of the two women on a four-player court. */
function poolFor(sport, viewerJoined) {
    // The viewer is deliberately absent from PADEL_POOL, so `viewerJoined` on
    // a padel fixture cannot be honoured and is asserted against in the guards
    // rather than silently ignored here.
    if (sport === "padel") return PADEL_POOL;
    // The viewer leads the roster when he is on the game, so he is the first
    // face shown; otherwise he is excluded entirely and six men remain.
    return viewerJoined
        ? FOOTBALL_POOL
        : FOOTBALL_POOL.filter((u) => u !== SOPHIE);
}

/**
 * CAST_PHOTOS — Tim is choosing the source (brief 3).
 *
 * Until a URL is set here, the account keeps its current avatar. Leave a uid
 * out entirely to leave it untouched; the capture notes then record which
 * screens show faces. Any URL set here is backed up and restored like every
 * other field.
 *
 * PENDING: Tim said he has a source and will provide it. Fill this in before
 * the first capture pass, re-run with --write, and nothing else changes.
 */
const CAST_PHOTOS = {
    "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/XXIV4AJNHvPoQKpBXwKOaA7C3Ob2.jpg",  // viewer  M  Léo M. / Alex R.
    "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/zfIAAxFq6RfVtpAZ9DHUnM5U9nz2.jpg",  // M
    "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1.jpg",  // M
    "9si5imsCVUUQ48LF5sc9XFLFtEj1":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/9si5imsCVUUQ48LF5sc9XFLFtEj1.jpg",  // M
    "Go2YXYj9FFW6xG28HZNBcrDkIJV2":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/Go2YXYj9FFW6xG28HZNBcrDkIJV2.jpg",  // M
    "xz7cm07tVlZkt71QsLdmeTSCPYI3":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/xz7cm07tVlZkt71QsLdmeTSCPYI3.jpg",  // M
    "FkWN1YsfFtP5PwTCxBEpZ9NpMS23":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/FkWN1YsfFtP5PwTCxBEpZ9NpMS23.jpg",  // M
    "8vZmdIBOZTcqMFMQKltTcfc7ffl1":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/8vZmdIBOZTcqMFMQKltTcfc7ffl1.jpg",  // F  padel only
    "hQmClsn4bFU79IvwqTJuYrZdOg63":
        "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/hQmClsn4bFU79IvwqTJuYrZdOg63.jpg",  // F  padel only
};

/**
 * Names, per cast. `display_name` is what the app renders; `first_name` and
 * `last_name` back it. Skill levels are varied deliberately -- every test
 * account currently sits at a flat 5.0, and a roster of identical levels is
 * the single most obviously fake thing on the game sheet (brief 1, screen 3).
 */
/**
 * Names, per cast, chosen from BIRTH-COHORT statistics rather than from
 * today's popular-name lists (research 2026-09-23, sources in git history).
 *
 * THE MISTAKE THIS AVOIDS: the obvious move is to reach for the current INSEE
 * top ten -- Léo, Gabriel, Raphaël, Louise, Jade. Those are the names of
 * TODDLERS. A 5-a-side roster of 20-35 year olds was born 1991-2006, and that
 * cohort's names are the Maxime / Romain / Quentin generation. Using baby
 * names on an adult roster is subtly wrong in a way that is hard to place and
 * easy to feel, which is exactly the "seeded data" tell we are avoiding.
 *
 * PADEL USES AN OLDER COHORT AGAIN. FFT data has the 31-50 bracket
 * "largement dominante" in French padel, so the two women are drawn from a
 * 1980s birth cohort (Julie, Camille) rather than a 1990s one. The sports are
 * genuinely different populations and the names now say so.
 *
 * The two Maghrebi names are FOOTBALL ONLY and both male, per Tim. Mehdi
 * ranked #62 nationally in 1993 -- the highest-placed Arab name in the French
 * top 100 for that cohort -- and Rayan is in the Seine-Saint-Denis top ten
 * today, which is what makes a Paris-region roster read as real.
 *
 * `soccer_skill_level` and `padel_skill_level` are varied deliberately: every
 * test account sits at a flat 5.0 today, and a roster of identical levels is
 * the single most obviously fake thing on the game sheet (brief §1, screen 3).
 */
const CASTS = {
    fr: {
        viewerLanguage: "fr",
        // Eurozone. `formatCurrency` puts the symbol AFTER for EUR ("8€") and
        // BEFORE for USD ("$8"), so this is a layout difference in the price
        // pill, not only a glyph swap -- which is why each cast is captured
        // with its own currency rather than swapped in post.
        currency: "EUR",
        people: {
            // --- the seven men: football (born ~1991-2005) ---
            [SOPHIE]: { display: "Maxime L.", first: "Maxime", last: "L.", soccer: 6.2, padel: 5.8 },
            [GINA]:   { display: "Romain P.", first: "Romain", last: "P.", soccer: 7.1, padel: 6.4 },
            [MARCO]:  { display: "Mehdi A.",  first: "Mehdi",  last: "A.", soccer: 5.4, padel: 5.1 },
            [NOAH]:   { display: "Quentin D.", first: "Quentin", last: "D.", soccer: 4.9, padel: 5.5 },
            [LIAM]:   { display: "Rayan B.",  first: "Rayan",  last: "B.", soccer: 7.4, padel: 6.1 },
            [TODD]:   { display: "Clément G.", first: "Clément", last: "G.", soccer: 5.7, padel: 4.8 },
            [SPARE]:  { display: "Julien M.", first: "Julien", last: "M.", soccer: 6.5, padel: 6.9 },
            // --- the two women: padel only (born ~1980-1992) ---
            [LUCIA]:  { display: "Julie R.",  first: "Julie",  last: "R.", soccer: 5.2, padel: 7.2 },
            [MARC]:   { display: "Camille T.", first: "Camille", last: "T.", soccer: 5.0, padel: 6.6 },
        },
        // Real Paris partner centres, as display strings only. The fixtures do
        // NOT sit at these coordinates -- see the header.
        venues: {
            soccerA: { centre: "LE FIVE Paris 17", address: "3 Rue du Docteur Paul Brousse, 75017 Paris" },
            soccerB: { centre: "LE FIVE Paris 18", address: "58 Rue Championnet, 75018 Paris" },
            soccerC: { centre: "UrbanSoccer Puteaux", address: "35 Rue Lucien Voilin, 92800 Puteaux" },
            soccerD: { centre: "Stadium Thiais", address: "1 Rue Jean Jaurès, 94320 Thiais" },
            padelA: { centre: "Casa Padel Saint-Denis", address: "5 Avenue du Stade de France, 93200 Saint-Denis" },
            padelB: { centre: "4PADEL Montreuil", address: "127 Rue de Paris, 93100 Montreuil" },
        },
    },
    intl: {
        viewerLanguage: "en",
        // EN and ES both ship with USD (Tim, 2026-09-22: the ES listing is
        // American Spanish for now, not Spain). IT is Eurozone and therefore
        // captured from the `fr` cast's EUR pass, with its own language.
        currency: "USD",
        people: {
            // --- the seven men: cross-market football names ---
            [SOPHIE]: { display: "Lucas R.", first: "Lucas", last: "R.", soccer: 6.2, padel: 5.8 },
            [GINA]:   { display: "Mateo G.", first: "Mateo", last: "G.", soccer: 7.1, padel: 6.4 },
            [MARCO]:  { display: "Daniel S.", first: "Daniel", last: "S.", soccer: 5.4, padel: 5.1 },
            [NOAH]:   { display: "Marco B.", first: "Marco", last: "B.", soccer: 4.9, padel: 5.5 },
            [LIAM]:   { display: "Tom W.",   first: "Tom",   last: "W.", soccer: 7.4, padel: 6.1 },
            [TODD]:   { display: "Andrés M.", first: "Andrés", last: "M.", soccer: 5.7, padel: 4.8 },
            [SPARE]:  { display: "Martín C.", first: "Martín", last: "C.", soccer: 6.5, padel: 6.9 },
            // --- the two women: padel only. Spanish-language, because padel's
            // centre of gravity is Hispanic (Spain alone has 17,300 courts).
            [LUCIA]:  { display: "Laura V.", first: "Laura", last: "V.", soccer: 5.2, padel: 7.2 },
            [MARC]:   { display: "Marta D.", first: "Marta", last: "D.", soccer: 5.0, padel: 6.6 },
        },
        // Neutral, could-be-anywhere. No city name in any of them.
        venues: {
            soccerA: { centre: "Riverside Five", address: "12 Riverside Way" },
            soccerB: { centre: "Eastside Arena", address: "40 Eastside Road" },
            soccerC: { centre: "Northgate Sports Park", address: "8 Northgate Lane" },
            soccerD: { centre: "Parkside Pitches", address: "23 Parkside Avenue" },
            padelA: { centre: "Harbour Padel Club", address: "5 Harbour View" },
            padelB: { centre: "Central Padel", address: "17 Mill Street" },
        },
    },
};


/** Every field the restyle touches, and therefore every field backed up. */
const BACKED_UP_FIELDS = [
    "display_name", "first_name", "last_name", "nickname",
    "photo_url", "hash_pic",
    "soccer_skill_level", "padel_skill_level",
    "language", "stats", "friends", "last_label",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function kmFrom(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

/** Today at a given local hour. The app renders each game in its own timezone,
 *  so local hours are what the card will actually say. */
function todayAt(hour, minute, dayOffset = 0) {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
}

/**
 * `teams` with `filled` taken spots out of `max`, drawn from `people` in order.
 *
 * Throws rather than repeating a uid, for the reason stated above: a repeated
 * reference IS a +1 in this schema.
 */
function roster(filled, max, people) {
    if (filled > people.length) {
        throw new Error(
            `roster(${filled}/${max}): only ${people.length} people available. ` +
            `Shrink the game rather than repeating a uid -- a repeat is a +1.`
        );
    }
    const spots = [];
    for (let i = 0; i < max; i++) {
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

/**
 * A stat block in the exact shape of gen2/recomputeUserStats.js emptyBlock(),
 * with the caller's overrides applied and the nesting invariants checked.
 */
function statBlock(overrides = {}) {
    const b = {
        games_played: 0,
        games_with_result: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        games_with_score: 0,
        goals: 0,
        assists: 0,
        goals_conceded: 0,
        games_as_goalkeeper: 0,
        matches_with_result: 0,
        matches_won: 0,
        sets_played: 0,
        sets_won: 0,
        padel_games_played: 0,
        padel_games_won: 0,
        first_result_game_date: null,
        last_played_date: null,
        ...overrides,
        // Stamped like the real writer does, so nothing downstream can tell
        // this block apart by shape alone.
        computed_at: new Date(),
        source_version: 1,
    };

    // The same assertions recomputeUserStats makes. A fixture that violates
    // them would render a profile that cannot occur in production.
    if (b.games_with_score > b.games_with_result ||
        b.games_with_result > b.games_played) {
        throw new Error(
            `stat block denominators do not nest: score=${b.games_with_score} ` +
            `result=${b.games_with_result} played=${b.games_played}`
        );
    }
    if (b.wins + b.draws + b.losses !== b.games_with_result) {
        throw new Error(
            `stat block W/D/L mismatch: ${b.wins}+${b.draws}+${b.losses} ` +
            `!= ${b.games_with_result}`
        );
    }
    if (b.matches_won > b.matches_with_result ||
        b.sets_won > b.sets_played ||
        b.padel_games_won > b.padel_games_played) {
        throw new Error("stat block padel denominators do not nest");
    }
    return b;
}

/** The viewer's profile numbers for screen 5. Deliberately modest and
 *  plausible: a player who has been around a season, not a superhuman. */
function viewerStats() {
    return {
        soccer: statBlock({
            games_played: 34,
            games_with_result: 28,
            wins: 16,
            draws: 5,
            losses: 7,
            games_with_score: 24,
            goals: 21,
            assists: 13,
            last_played_date: todayAt(19, 0, -2),
            first_result_game_date: todayAt(20, 0, -240),
        }),
        padel: statBlock({
            games_played: 12,
            matches_with_result: 10,
            matches_won: 6,
            sets_played: 23,
            sets_won: 13,
            padel_games_played: 178,
            padel_games_won: 94,
            last_played_date: todayAt(18, 30, -5),
            first_result_game_date: todayAt(19, 0, -160),
        }),
    };
}

// ---------------------------------------------------------------------------
// THE PLAN — the five screens, as fixtures.
//
// Screen 2 wants 5-6 games today spread over the evening, mostly 1-3 spots
// left, one FULL. Screens 1, 3, 4 and 5 each need one specific game. Several
// fixtures serve more than one screen, which is intended: the games list must
// contain the very game the sheet screenshot opens, or the two screens
// contradict each other.
// ---------------------------------------------------------------------------
function buildPlan(cast) {
    const v = cast.venues;

    return [
        // --- SCREEN 2 (games list, today) + SCREEN 3 (the sheet) ------------
        //
        // The viewer has NOT joined this one (brief, screen 3), so it shows a
        // Join CTA and 9/10 filled = "1 place". It is also the first card of
        // the evening in the list.
        {
            key: "sheet_soccer",
            screens: "2,3",
            sport: "soccer",
            date: todayAt(18, 30),
            // 8 of 9, not 9 of 10. The viewer has NOT joined this game, so
            // only the 8 OTHER cast members can stand on it -- 9/10 would need
            // a repeated uid, which is a +1, and the roster guard refuses it.
            // A 9-a-side pitch with one spot left reads exactly the same.
            duration: 60,
            max: 6,
            filled: 5,
            viewerJoined: false,
            venue: v.soccerA,
            price: 8,
            levelDeltas: ["five_six", "seven_eight"],
        },
        {
            key: "list_padel_1",
            screens: "2",
            sport: "padel",
            date: todayAt(19, 0),
            duration: 90,
            max: 4,
            filled: 3,
            viewerJoined: false,
            venue: v.padelA,
            price: 12,
            levelDeltas: ["five_six", "seven_eight"],
        },
        {
            key: "list_soccer_full",
            screens: "2",
            sport: "soccer",
            date: todayAt(19, 30),
            duration: 60,
            max: 6,
            filled: 6,
            viewerJoined: false,
            venue: v.soccerB,
            price: 10,
            levelDeltas: ["five_six"],
        },
        {
            key: "list_soccer_2",
            screens: "2",
            sport: "soccer",
            date: todayAt(20, 30),
            duration: 60,
            max: 6,
            filled: 4,
            viewerJoined: false,
            venue: v.soccerC,
            price: 8,
            levelDeltas: ["three_four", "five_six"],
        },
        {
            key: "list_padel_2",
            screens: "2",
            sport: "padel",
            date: todayAt(21, 0),
            duration: 90,
            max: 4,
            filled: 2,
            viewerJoined: false,
            venue: v.padelB,
            price: 12,
            levelDeltas: ["five_six", "seven_eight"],
        },
        {
            key: "list_soccer_3",
            screens: "2",
            sport: "soccer",
            date: todayAt(21, 30),
            duration: 60,
            max: 6,
            filled: 3,
            viewerJoined: false,
            venue: v.soccerD,
            price: 8,
            levelDeltas: ["five_six", "seven_eight"],
        },

        // --- SCREEN 1 (invitations on Home) ---------------------------------
        //
        // Nearly-full games tonight and tomorrow, at least one padel. The
        // viewer is NOT on the roster -- an invitation to a game you are
        // already on makes no sense -- so `filled` leaves exactly the spot
        // the invitation is offering.
        {
            key: "invite_soccer",
            screens: "1",
            sport: "soccer",
            date: todayAt(20, 0),
            duration: 60,
            max: 6,
            filled: 4, // 2 places
            viewerJoined: false,
            venue: v.soccerB,
            price: 8,
            levelDeltas: ["five_six", "seven_eight"],
            invitation: true,
        },
        {
            key: "invite_padel",
            screens: "1",
            sport: "padel",
            date: todayAt(19, 30, 1),
            duration: 90,
            max: 4,
            filled: 3, // 1 place
            viewerJoined: false,
            venue: v.padelA,
            price: 12,
            levelDeltas: ["five_six", "seven_eight"],
            invitation: true,
        },
        {
            key: "invite_soccer_2",
            screens: "1",
            sport: "soccer",
            date: todayAt(19, 0, 1),
            // Same constraint as sheet_soccer: 8 others available, so a
            // "1 place" invitation is 8/9 rather than 9/10.
            duration: 60,
            max: 6,
            filled: 5, // 1 place
            viewerJoined: false,
            venue: v.soccerC,
            price: 10,
            levelDeltas: ["five_six"],
            invitation: true,
        },

        // --- SCREEN 4 (Live board, mid-match) -------------------------------
        //
        // Two fixtures, because the brief wants soccer for FR/EN and padel for
        // ES/IT. Both are seeded every run; the capture picks the one it needs,
        // which costs nothing and avoids a second seeding pass mid-session.
        //
        // Kickoff is in the PAST so the match is genuinely underway, and teams
        // are pre-confirmed -- Live refuses to score before that step.
        {
            key: "live_soccer",
            screens: "4",
            sport: "soccer",
            date: todayAt(new Date().getHours(), new Date().getMinutes() - 34),
            duration: 60,
            // The whole cast (viewer + 8) is 9 people, so a FULL soccer game
            // is 9-a-side. Ten would need a repeated uid, i.e. a +1.
            max: 6,
            filled: 6,
            viewerJoined: true,
            venue: v.soccerA,
            price: 8,
            levelDeltas: ["five_six", "seven_eight"],
            live: { sport: "soccer", goals: "3-2" },
        },
        {
            key: "live_padel",
            screens: "4",
            sport: "padel",
            date: todayAt(new Date().getHours(), new Date().getMinutes() - 42),
            duration: 90,
            max: 4,
            filled: 4,
            // The viewer is male in both casts and padel is the women's surface,
            // so he is NOT on this court. Screen 4's padel board is captured as
            // a spectator view, which is also how most Live viewing happens.
            viewerJoined: false,
            venue: v.padelA,
            price: 12,
            levelDeltas: ["five_six", "seven_eight"],
            live: { sport: "padel", target: "6-4, 3-2, 30-15" },
        },

        // --- SCREEN 5 (wrap-up share card) ----------------------------------
        //
        // Played, scored 5-3, viewer credited with 2 goals. The goal cap (spec
        // 2.4) means attributed goals cannot exceed the scoreline, so 2 of 5
        // is valid. Result AND score are both agreed, so the card reads as
        // settled rather than still asking.
        {
            key: "share_played",
            screens: "5",
            sport: "soccer",
            date: todayAt(19, 0, -2),
            duration: 60,
            // Full, at the cast's true size (see live_soccer).
            max: 6,
            filled: 6,
            viewerJoined: true,
            venue: v.soccerA,
            price: 8,
            levelDeltas: ["five_six", "seven_eight"],
            played: { periods: [{ team_a: 5, team_b: 3 }], viewerGoals: 2 },
        },
    ];
}

// ---------------------------------------------------------------------------
// Live event generation
// ---------------------------------------------------------------------------

/**
 * Soccer goals as real appended `point` + `attribution` pairs.
 *
 * Never writes a stored score: the board folds these events, exactly as it
 * folds a real match's. A stored score would photograph identically and prove
 * nothing about the feature.
 */
function soccerLiveEvents(kickoff, scorers) {
    const events = [];
    for (const g of scorers) {
        const at = new Date(kickoff.getTime() + g.min * MIN);
        const cid = `seed_${TAG}_${g.min}`;
        events.push({
            type: "point",
            side: g.side,
            created_by: g.scorer,
            created_at: Timestamp.fromDate(at),
            client_at: Timestamp.fromDate(at),
            client_event_id: cid,
        });
        events.push({
            type: "attribution",
            attributes: cid,
            scorer_id: g.scorer,
            created_by: g.scorer,
            created_at: Timestamp.fromDate(new Date(at.getTime() + 5000)),
            client_at: Timestamp.fromDate(new Date(at.getTime() + 5000)),
            client_event_id: `${cid}_attr`,
        });
    }
    return events;
}

/**
 * Padel points as real appended events.
 *
 * The pattern is VERIFIED against the app's own fold rather than assumed: a
 * padel scoreboard is not something to eyeball. `foldLiveScore` is the same
 * function the board uses, so if this pattern does not produce the target
 * score the script refuses to seed instead of photographing a wrong board.
 */
function padelPointEvents(pattern, kickoff) {
    return pattern.split("").map((c, i) => {
        const at = new Date(kickoff.getTime() + (i + 1) * 20 * 1000);
        return {
            type: "point",
            side: c === "a" ? "team_a" : "team_b",
            created_by: SOPHIE,
            created_at: Timestamp.fromDate(at),
            client_at: Timestamp.fromDate(at),
            client_event_id: `seed-${TAG}-${String(i).padStart(3, "0")}`,
        };
    });
}

/** Load the app's fold, so padel patterns can be proven rather than trusted. */
function loadFold() {
    try {
        return require(path.join(
            __dirname, "..", "cloud-functions", "functions", "gen2", "foldLiveScore"
        )).foldLiveScore;
    } catch (e) {
        return null;
    }
}

/**
 * Build a padel point pattern reaching: set 1 won 6-4, set 2 at 3-2, point 30-15.
 *
 * Built by construction (win N games cleanly, then part of a game), then
 * VERIFIED with the real fold. Constructed rather than searched because a
 * padel game is 4 clean points and the arithmetic is deterministic.
 */
function padelPattern() {
    let p = "";
    const game = (side) => { p += side.repeat(4); };       // a clean game to 40-0 -> game
    // Set 1: A wins 6-4. Ten games: A takes 6, B takes 4.
    for (let i = 0; i < 4; i++) { game("a"); game("b"); }  // 4-4
    game("a"); game("a");                                   // 6-4, set to A
    // Set 2: 3-2 to A. Five games.
    for (let i = 0; i < 2; i++) { game("a"); game("b"); }  // 2-2
    game("a");                                              // 3-2
    // Current game: 30-15 -> A two points, B one.
    p += "aab";
    return p;
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

async function assertGuards(plan) {
    // Guard 1: every uid on every roster is a test account, and Tim is absent.
    const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
    const testIds = new Set();
    for (const uid of EVERYONE) {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) throw new Error(`cast uid ${uid} does not exist`);
        const d = snap.data();
        if (d.is_test_account !== true) {
            throw new Error(
                `cast uid ${uid} (${d.display_name}) is NOT is_test_account. ` +
                `Refusing to seed.`
            );
        }
        if (d.type === "pro" || d.type === "super_pro") {
            throw new Error(
                `cast uid ${uid} (${d.display_name}) is a ${d.type} account. ` +
                `A pro on a player roster misrepresents the fixture.`
            );
        }
        testIds.add(uid);
    }
    if (EVERYONE.includes(TIM)) {
        throw new Error("Tim's account must never appear in a store fixture.");
    }

    // Guard 2: prove the venue coordinates are nowhere near Paris. The DISPLAY
    // names are Paris centres in the fr cast, which is exactly why this is
    // checked on coordinates rather than on the name.
    const d = kmFrom(TEST_VENUE.lat, TEST_VENUE.lng, PARIS.lat, PARIS.lng);
    if (d < MIN_KM_FROM_PARIS) {
        throw new Error(
            `test venue is ${Math.round(d)}km from Paris, under the ` +
            `${MIN_KM_FROM_PARIS}km floor. Refusing to seed.`
        );
    }

    // Guard 3b: no padel fixture may claim the viewer. PADEL_POOL deliberately
    // excludes him, so `viewerJoined: true` on a padel game would be a claim
    // the roster silently does not honour.
    for (const p of plan) {
        if (p.sport === "padel" && p.viewerJoined) {
            throw new Error(
                `fixture '${p.key}' is padel with viewerJoined: true, but the ` +
                `viewer is not in PADEL_POOL. Set viewerJoined: false.`
            );
        }
    }

    // Guard 3: every roster fits without repeating a uid.
    for (const p of plan) {
        const people = poolFor(p.sport, p.viewerJoined);
        roster(p.filled, p.max, people);
        assertTestRoster(
            people.slice(0, p.filled), testIds
        );
    }

    // Guard 4: the padel Live pattern really does produce the target board.
    const fold = loadFold();
    if (fold) {
        const pattern = padelPattern();
        const events = pattern.split("").map((c, i) => ({
            type: "point",
            side: c === "a" ? "team_a" : "team_b",
            created_at: i + 1,
            client_event_id: `x${i}`,
        }));
        const f = fold(events, "padel").padel;
        const got =
            `sets ${f.setsA}-${f.setsB}, games ${f.gamesA}-${f.gamesB}, ` +
            `points ${f.pointA}-${f.pointB}`;
        const ok = f.setsA === 1 && f.setsB === 0 &&
            f.gamesA === 3 && f.gamesB === 2 &&
            String(f.pointA) === "30" && String(f.pointB) === "15";
        if (!ok) {
            throw new Error(
                `padel Live pattern does not fold to the target board.\n` +
                `  wanted: sets 1-0, games 3-2, points 30-15\n` +
                `  got:    ${got}\n` +
                `Fix padelPattern() rather than photographing a wrong board.`
            );
        }
        console.log(`  padel Live pattern verified against the app fold: ${got}`);
    } else {
        console.warn(
            "  WARNING: could not load foldLiveScore; padel board is UNVERIFIED. " +
            "Check the board by eye before capturing screen 4 in es/it."
        );
    }

    console.log(
        `guards ok: private · ${TEST_VENUE.centre} coords ` +
        `(${Math.round(d)}km from Paris) · ${EVERYONE.length} test accounts · no Tim\n`
    );
}

/** Re-read what was written. Asserting the plan is not asserting the data. */
async function verifyWritten() {
    const snap = await db.collection("games").where("seed_tag", "==", TAG).get();
    const bad = [];
    for (const doc of snap.docs) {
        const x = doc.data();
        if (x.is_test_game !== true) bad.push(`${doc.id} not flagged is_test_game`);
        if (x.visibility !== "private") bad.push(`${doc.id} visibility=${x.visibility}`);
        if (x.place_id !== TEST_VENUE.placeId) bad.push(`${doc.id} place_id=${x.place_id}`);
        if (x.location) {
            const km = kmFrom(x.location.latitude, x.location.longitude, PARIS.lat, PARIS.lng);
            if (km < MIN_KM_FROM_PARIS) {
                bad.push(`${doc.id} is ${Math.round(km)}km from Paris`);
            }
        }
        for (const s of x.teams || []) {
            if (s.user_id && !EVERYONE.includes(s.user_id)) {
                bad.push(`${doc.id} has non-cast uid ${s.user_id}`);
            }
        }
    }
    if (bad.length) {
        console.error("\n!! GUARD VIOLATION IN WRITTEN DATA:");
        bad.forEach((b) => console.error(`   ${b}`));
        console.error(`   purge immediately: node seed_store_screenshots.js --purge`);
        process.exit(1);
    }
    console.log(
        `verified ${snap.size} written game(s): all flagged, all private, ` +
        `all at the test venue, cast accounts only`
    );
}

// ---------------------------------------------------------------------------
// Cast restyle / restore
// ---------------------------------------------------------------------------

/**
 * Back up, then restyle. The backup is written ONLY if absent, so re-running
 * with a different --cast never overwrites the original values with the
 * previous cast's. That is what makes --restore safe after any number of runs.
 */
async function applyCast(cast, dryRun) {
    const stats = viewerStats();
    const lines = [];

    for (const uid of EVERYONE) {
        const person = cast.people[uid];
        if (!person) continue;
        const snap = await db.collection("users").doc(uid).get();
        const cur = snap.data() || {};

        const update = {
            display_name: person.display,
            first_name: person.first,
            last_name: person.last,
            // Cleared deliberately: a leftover "Marc" nickname would override
            // the new display name wherever the app prefers a nickname.
            nickname: "",
            soccer_skill_level: person.soccer,
            padel_skill_level: person.padel,
        };

        if (CAST_PHOTOS[uid]) {
            update.photo_url = CAST_PHOTOS[uid];
            // A stale blurhash renders the OLD avatar's blur behind the new
            // photo, which looks like a loading bug in a screenshot.
            update.hash_pic = "";
        }

        if (uid === SOPHIE) {
            update.language = cast.viewerLanguage;
            update.stats = stats;
            // The games list header reads "autour de chez toi" from this, and
            // a city name here would put "autour de Kinshasa" on screen 2.
            update.last_label = "home";
            // Friends with every organizer, so private games render undimmed.
            // Friends with everyone else, so a private game organized by any
            // of them renders undimmed in the list (see the header).
            update.friends = EVERYONE
                .filter((u) => u !== SOPHIE)
                .map((u) => db.collection("users").doc(u));
        }

        lines.push(
            `  ${uid.slice(0, 6)}…  ${String(cur.display_name || "?").padEnd(16)} -> ` +
            `${person.display.padEnd(12)} soccer ${person.soccer} padel ${person.padel}` +
            (uid === SOPHIE
                ? `  [VIEWER: lang=${cast.viewerLanguage}, stats, friends x${EVERYONE.length - 1}]`
                : "")
        );

        if (dryRun) continue;

        // Back up ONCE. A second --cast run must not capture the first cast.
        if (!cur[BACKUP_FIELD]) {
            const backup = {};
            for (const f of BACKED_UP_FIELDS) {
                backup[f] = cur[f] === undefined ? null : cur[f];
            }
            update[BACKUP_FIELD] = backup;
        }
        await db.collection("users").doc(uid).update(update);
    }

    console.log(lines.join("\n"));
    return lines.length;
}

/**
 * Put every backed-up field back and delete the backup. Idempotent: an account
 * with no backup is simply skipped, so running --restore twice is harmless and
 * running it after a partial run restores whatever was actually changed.
 */
async function restoreCast() {
    let restored = 0;
    let skipped = 0;

    for (const uid of EVERYONE) {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) continue;
        const cur = snap.data();
        const backup = cur[BACKUP_FIELD];
        if (!backup) { skipped += 1; continue; }

        const update = { [BACKUP_FIELD]: FieldValue.delete() };
        for (const f of BACKED_UP_FIELDS) {
            // A field that did not exist before is deleted rather than set to
            // null: writing null would leave a field the account never had.
            update[f] = backup[f] === null ? FieldValue.delete() : backup[f];
        }
        await db.collection("users").doc(uid).update(update);
        console.log(`  restored ${uid.slice(0, 6)}…  -> ${backup.display_name || "(no name)"}`);
        restored += 1;
    }

    console.log(`\nrestored ${restored} account(s), ${skipped} had no backup`);
    return restored;
}

// ---------------------------------------------------------------------------
// Purge — THIS TAG ONLY. See the header for why this is not the broad purge.
// ---------------------------------------------------------------------------

async function purge(dryRun) {
    const snap = await db.collection("games").where("seed_tag", "==", TAG).get();
    if (dryRun) {
        console.log(`  would delete ${snap.size} game(s) tagged ${TAG}`);
        return snap.size;
    }

    let n = 0;
    for (const d of snap.docs) {
        // live_events must go with the parent, or it survives the game.
        const ev = await d.ref.collection("live_events").get();
        const b = db.batch();
        ev.docs.forEach((e) => b.delete(e.ref));
        b.delete(d.ref);
        await b.commit();
        n += 1;
    }

    // The invitations this script created, and the game references it added to
    // user documents. Left behind, these are invitations pointing at deleted
    // games -- which is precisely the litter the tag exists to prevent.
    const invites = await db.collection("game_invitations")
        .where("seed_tag", "==", TAG).get();
    for (let i = 0; i < invites.docs.length; i += 400) {
        const b = db.batch();
        invites.docs.slice(i, i + 400).forEach((x) => b.delete(x.ref));
        await b.commit();
    }

    console.log(`  deleted ${n} game(s) and ${invites.size} invitation(s) tagged ${TAG}`);
    return n;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
    if (RESTORE) {
        console.log("restoring test accounts from store_shots_backup\n");
        await restoreCast();
        process.exit(0);
    }

    if (PURGE) {
        console.log(`purging seed_tag == ${TAG}\n`);
        await purge(false);
        console.log("\npurge done. Run --restore to put the cast back.");
        process.exit(0);
    }

    const cast = CASTS[CAST];
    const plan = buildPlan(cast);

    const langs = Object.entries(CAPTURE_MATRIX)
        .filter(([, v]) => v.cast === CAST)
        .map(([l]) => l);

    console.log(
        `\nSTORE SCREENSHOTS 5.2.0 — cast '${CAST}' — ` +
        `${cast.currency} — captures: ${langs.join(", ")} — ` +
        `${WRITE ? "WRITING" : "DRY RUN"}\n`
    );

    await assertGuards(plan);

    // The cast avatars are what screens 1 and 3 are made of. Seeding with
    // initials is fine for screens 2 and 4, so this warns rather than blocks.
    const withPhotos = EVERYONE.filter((u) => CAST_PHOTOS[u]).length;
    if (withPhotos < EVERYONE.length) {
        console.warn(
            `  NOTE: ${EVERYONE.length - withPhotos} of ${EVERYONE.length} cast ` +
            `members have no CAST_PHOTOS entry and keep their initials avatar.\n` +
            `  Screens 1 (invitations) and 3 (roster) show faces; record this in ` +
            `CAPTURE_NOTES.md if you capture them now.\n`
        );
    }

    console.log("cast:");
    await applyCast(cast, !WRITE);

    console.log(`\ngames (${plan.length}):`);

    if (WRITE) await purge(false);

    const pad = (n) => String(n).padStart(2, "0");
    const created = [];

    for (const p of plan) {
        const people = poolFor(p.sport, p.viewerJoined);
        const teams = roster(p.filled, p.max, people);
        const attendees = teams
            .filter((s) => s.user_id)
            .map((s) => db.collection("users").doc(s.user_id));
        const organizer = people[0];

        const when =
            `${pad(p.date.getDate())}/${pad(p.date.getMonth() + 1)} ` +
            `${pad(p.date.getHours())}:${pad(p.date.getMinutes())}`;
        console.log(
            `  [${p.screens}] ${when}  ${String(p.filled).padStart(2)}/${p.max}  ` +
            `${p.sport.padEnd(6)} ${p.venue.centre}`
        );

        if (!WRITE) continue;

        // testGame() applies is_test_game, private, and the test venue LAST,
        // so nothing below can override them. `centre` and `address` are then
        // re-set on purpose -- they are the display strings, and they are the
        // only thing a screenshot shows. The place_id and coordinates stay at
        // the test venue, which is what the guard actually protects.
        const doc = testGame({
            seed_tag: TAG,
            store_shots_cast: CAST,
            date: Timestamp.fromDate(p.date),
            end_time: Timestamp.fromDate(new Date(p.date.getTime() + p.duration * MIN)),
            duration: p.duration,
            status: p.played ? "played" : "published",
            organizer,
            location: new GeoPoint(TEST_VENUE.lat, TEST_VENUE.lng),
            max_players: p.max,
            teams,
            attendees,
            interested: [],
            messages: [],
            outsiders: [],
            price: p.price,
            price_undiscounted: p.price,
            currency: cast.currency,
            payment_type: "on-site",
            sport: p.sport,
            // Padel is always 2v2. Soccer is half the pitch a side -- floored,
            // because an odd max_players (9-a-side, used where the cast is one
            // short of a full ten) would otherwise render "4.5v4.5".
            type: p.sport === "padel"
                ? "2v2"
                : `${Math.floor(p.max / 2)}v${Math.floor(p.max / 2)}`,
            level_deltas: p.levelDeltas || [],
            gold_exclusive: false,
            level: 3,
            mood: "fun",
            time_zone: "Europe/Paris",
            reservation_name: p.key,
            description: "",
            created_on: FieldValue.serverTimestamp(),
        });

        // The display strings, applied after testGame(). Coordinates unchanged.
        doc.centre = p.venue.centre;
        doc.address = p.venue.address;

        // A played, settled game: both result and score agreed, so the share
        // card reads as final rather than still asking a question.
        if (p.played) {
            const proposedAt = Timestamp.fromDate(
                new Date(p.date.getTime() + p.duration * MIN)
            );
            const agreed = people.slice(0, Math.min(4, p.filled));
            doc.score_proposals = [{
                periods: p.played.periods,
                proposed_by: organizer,
                proposed_at: proposedAt,
                agreed_by: agreed,
            }];
            doc.result_proposals = [{
                winning_side: "team_a",
                is_draw: false,
                proposed_by: organizer,
                proposed_at: proposedAt,
                agreed_by: agreed,
            }];
        }

        if (p.live) {
            // Teams confirmed BEFORE kickoff: Live refuses to score until this
            // step is done, and walking it by hand for every capture is the
            // friction this fixture removes.
            doc.live_teams_confirmed_at = Timestamp.fromDate(
                new Date(p.date.getTime() - 5 * MIN)
            );
            doc.live_opened_at = Timestamp.fromDate(
                new Date(p.date.getTime() - 5 * MIN)
            );
        }

        const ref = await db.collection("games").add(doc);
        created.push({ key: p.key, id: ref.id, screens: p.screens });

        // --- Live events, appended like a real match ------------------------
        if (p.live && p.live.sport === "soccer") {
            // 3-2 in the second half. Scorers spread across the roster so the
            // history does not read as one player's match.
            const evs = soccerLiveEvents(p.date, [
                { min: 8, side: "team_a", scorer: people[0] },
                { min: 21, side: "team_b", scorer: people[1] },
                { min: 29, side: "team_a", scorer: people[2] },
                { min: 34, side: "team_b", scorer: people[3] },
                { min: 38, side: "team_a", scorer: people[0] },
            ]);
            for (const e of evs) await ref.collection("live_events").add(e);
        }
        if (p.live && p.live.sport === "padel") {
            const evs = padelPointEvents(padelPattern(), p.date);
            for (const e of evs) await ref.collection("live_events").add(e);
        }

        // --- Invitations for screen 1 ---------------------------------------
        if (p.invitation) {
            await db.collection("game_invitations").add({
                seed_tag: TAG,
                inviter: db.collection("users").doc(organizer),
                invitee: db.collection("users").doc(SOPHIE),
                game: ref,
                game_date: Timestamp.fromDate(p.date),
                status: "pending",
                created: Timestamp.fromDate(new Date(Date.now() - 20 * MIN)),
            });
        }
    }

    if (!WRITE) {
        console.log(
            `\nDRY RUN — nothing written. Re-run with --write to seed.\n` +
            `Cast '${CAST}', ${plan.length} games, ` +
            `${plan.filter((p) => p.invitation).length} invitations, ` +
            `${plan.filter((p) => p.live).length} live boards.\n`
        );
        process.exit(0);
    }

    console.log("");
    await verifyWritten();

    console.log(
        `\nseeded ${created.length} game(s), tag ${TAG}, cast '${CAST}'.\n` +
        `When the capture session is over:\n` +
        `  node seed_store_screenshots.js --purge\n` +
        `  node seed_store_screenshots.js --restore\n`
    );
    process.exit(0);
}

run().catch((e) => {
    console.error("\nFAILED:", e.message);
    process.exit(1);
});
