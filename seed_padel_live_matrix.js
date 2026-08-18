// Poteau Live for PADEL, as a set of games — one per scoring state.
//
// Padel's scoreboard is a state machine, so "seed a game and tap it into the
// right state" is not practical: reaching a super tie-break by hand is ~120
// taps. This writes the EVENT LOG for each state instead, and lets the fold
// derive the score exactly as it will in production. Nothing here writes a
// score — that would be the counter the whole design exists to avoid.
//
// The point of the matrix is to LOOK at every state in a row and say "that one
// is wrong", rather than to seed one game and spend the morning trying to
// reach the interesting cases.
//
// SAFETY, inherited from seed_live_test_matrix.js:
//   visibility   private    -- cannot surface in anyone's feed or alerts
//   is_test_game true       -- findable and deletable
//   payment_type on-site    -- never touches Stripe
//   attendees    test accounts only, plus Tim
//
//   node seed_padel_live_matrix.js           # dry run, prints the matrix
//   node seed_padel_live_matrix.js --write   # replace and create
//   node seed_padel_live_matrix.js --clean   # delete the matrix, create nothing
const path = require("path");
const admin = require(path.join(
  "/Users/tmgnr/poteau-workspace/cloud-functions/functions",
  "node_modules/firebase-admin"
));
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
}
const db = admin.firestore();
const { Timestamp, GeoPoint } = admin.firestore;

// The SAME fold the app runs. Deriving the expected score here from the real
// implementation, rather than restating it, means this script cannot claim a
// state it does not actually produce.
const { foldLiveScore } = require(path.join(
  "/Users/tmgnr/poteau-workspace/cloud-functions/functions",
  "gen2/foldLiveScore"
));

const WRITE = process.argv.includes("--write");
const CLEAN = process.argv.includes("--clean");

// Marks every game this script owns, so a re-run can clear the last one.
const MATRIX_TAG = "padel_live_matrix";

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";

const MIN = 60 * 1000;

// PADEL IS FOUR PLAYERS, two per side. Not a 10-spot football roster.
function roster() {
  return [
    { team_side: "team_a", user_id: TIM, plus_one: false },
    { team_side: "team_a", user_id: GINA, plus_one: false },
    { team_side: "team_b", user_id: LUCIA, plus_one: false },
    { team_side: "team_b", user_id: NOAH, plus_one: false },
  ].map((s, i) => ({ spot_number: i + 1, status: "confirmed", ...s }));
}

// ---------------------------------------------------------------- sequences
//
// Expressed as point patterns ("aab" = A, A, B) and composed, so a case reads
// as the padel it represents rather than as a list of 48 events.

/** One clean game for `w`, conceding `lost` points. */
const g = (w, lost = 0) => {
  const l = w === "a" ? "b" : "a";
  return l.repeat(lost) + w.repeat(4);
};
/** A run of clean games: "abab" -> A, B, A, B. */
const gs = (pattern) => pattern.split("").map((c) => g(c)).join("");

/** Six games each: the 6-6 that opens a tie-break. */
const SIX_ALL = gs("abababababab");
/** A 6-0 set for A, then a 6-0 set for B: one set all, so a super tie-break. */
const ONE_SET_ALL = gs("aaaaaa") + gs("bbbbbb");

const MATRIX = [
  {
    label: "P1 · Début — 0-0, premier jeu",
    kickoffOffsetMin: -12,
    points: "",
    note: "Nothing tapped yet. The empty board: no sets row, no badge.",
  },
  {
    label: "P2 · 30-15 dans le premier jeu",
    kickoffOffsetMin: -15,
    points: "aab",
    note: "The ordinary case, and the one that runs 90% of a match.",
  },
  {
    label: "P3 · Égalité (40-40)",
    kickoffOffsetMin: -18,
    points: "aaabbb",
    note: "Deuce. Both sides print 40.",
  },
  {
    label: "P4 · Avantage",
    kickoffOffsetMin: -21,
    points: "aaabbba",
    note: "AD is 2 glyphs where 40 is 2 — check it does not resize the board.",
  },
  {
    label: "P5 · Milieu de set — 4-3, 40-15",
    kickoffOffsetMin: -24,
    points: gs("aaaabbb") + "aaab",
    note: "The three tiers all carrying a number. The main layout test.",
  },
  {
    label: "P6 · Tie-break à 6-6",
    kickoffOffsetMin: -27,
    points: SIX_ALL + "aaaabbb",
    note: "Points print as plain integers, and the badge must say TIE-BREAK.",
  },
  {
    label: "P7 · Un set partout — super tie-break",
    kickoffOffsetMin: -30,
    points: ONE_SET_ALL + "aaaaabbbb",
    note: "No games row at all. Badge says SUPER TIE-BREAK, to 10 not 7.",
  },
  {
    label: "P8 · Balle de match",
    kickoffOffsetMin: -33,
    points: gs("aaaaaa") + gs("aaaaa") + "aaa",
    note: "One set up, 5-0, 40-0. MATCH POINT under A's number.",
  },
  {
    label: "P9 · Match terminé — 2 sets à 0",
    kickoffOffsetMin: -50,
    duration: 60,
    points: gs("aaaaaa") + gs("aaaaaa"),
    note: "Won. Badge says the game is over, and TERMINER is on the board.",
  },
  {
    label: "P10 · Taps après la fin — doivent être ignorés",
    kickoffOffsetMin: -53,
    duration: 60,
    points: gs("aaaaaa") + gs("aaaaaa") + "abab",
    note: "Four stray taps after match point. The score must NOT move.",
  },
];

function game({ label, kickoffOffsetMin, duration = 90, teams }) {
  const kickoff = new Date(Date.now() + kickoffOffsetMin * MIN);
  return {
    doc: {
      address: "Padel Attitude, Dole",
      centre: "Padel Attitude",
      reservation_name: label,
      place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
      location: new GeoPoint(47.10255979999999, 5.5016487),
      date: Timestamp.fromDate(kickoff),
      end_time: Timestamp.fromDate(new Date(kickoff.getTime() + duration * MIN)),
      duration,
      max_players: 4,
      mood: "chill",
      organizer: TIM,
      type: "captain",
      price: 0,
      currency: "EUR",
      visibility: "private",
      players_to_find: 0,
      sport: "padel",
      payment_type: "on-site",
      time_zone: "Europe/Paris",
      country_code: "FR",
      level_deltas: ["five_six"],
      gold_exclusive: false,
      status: "published",
      poteau_live: true,
      is_test_game: true,
      [MATRIX_TAG]: true,
      created_on: Timestamp.now(),
      teams,
      attendees: teams.map((s) => db.collection("users").doc(s.user_id)),
      interested: [],
      messages: [],
      outsiders: [],
      // Teams are pre-confirmed on every game here: the teams step is shared
      // with football and already tested, and re-confirming it ten times to
      // reach ten scoreboards is exactly the friction this script removes.
      live_teams_confirmed_at: Timestamp.fromDate(
        new Date(kickoff.getTime() - 5 * MIN)
      ),
    },
    kickoff,
  };
}

/**
 * Turn a point pattern into real `live_events` documents.
 *
 * Spaced 20 seconds apart from kickoff, which is a realistic padel rally, so
 * the history's clock column reads plausibly rather than showing 200 points in
 * the same minute.
 */
function eventsFor(pattern, kickoff) {
  return pattern.split("").map((c, i) => {
    const at = new Date(kickoff.getTime() + (i + 1) * 20 * 1000);
    return {
      type: "point",
      side: c === "a" ? "team_a" : "team_b",
      created_by: TIM,
      created_at: Timestamp.fromDate(at),
      client_at: Timestamp.fromDate(at),
      // Deterministic, so re-running the seeder cannot produce duplicates that
      // the fold would then have to deduplicate.
      client_event_id: `seed-${i.toString().padStart(3, "0")}`,
    };
  });
}

/** What the fold says this pattern produces. Derived, never asserted. */
function describe(pattern) {
  const events = pattern.split("").map((c, i) => ({
    type: "point",
    side: c === "a" ? "team_a" : "team_b",
    created_at: i + 1,
    client_event_id: `x${i}`,
  }));
  const f = foldLiveScore(events, "padel");
  const p = f.padel;
  const sets = p.sets.map((s) => `${s.team_a}-${s.team_b}`).join(" ");
  return (
    `${p.setsA}-${p.setsB} sets` +
    (p.mode === "super_tiebreak" ? "" : `, ${p.gamesA}-${p.gamesB} games`) +
    `, ${p.pointA}-${p.pointB}` +
    ` [${p.mode}]` +
    (sets ? ` {${sets}}` : "") +
    (p.matchPointFor ? ` MATCH POINT ${p.matchPointFor}` : "") +
    (p.extraPoints ? ` +${p.extraPoints} ignored` : "")
  );
}

async function clearMatrix() {
  const snap = await db.collection("games").where(MATRIX_TAG, "==", true).get();
  if (snap.empty) return 0;
  // Delete the live_events subcollection too, or a re-run inherits old points.
  for (const d of snap.docs) {
    const ev = await d.ref.collection("live_events").get();
    for (const e of ev.docs) await e.ref.delete();
    await d.ref.delete();
  }
  return snap.size;
}

(async () => {
  console.log("POTEAU LIVE — PADEL test matrix at Padel Attitude, Dole");
  console.log("all private · is_test_game · on-site · poteau_live · sport=padel\n");

  for (const m of MATRIX) {
    const at = new Date(Date.now() + m.kickoffOffsetMin * MIN);
    console.log("  " + m.label);
    console.log(
      "      kickoff " + at.toTimeString().slice(0, 5) +
      " · " + m.points.length + " points → " + describe(m.points)
    );
    console.log("      " + m.note);
  }
  console.log("");

  if (CLEAN) {
    const n = await clearMatrix();
    console.log("deleted " + n + " padel matrix games. nothing created.");
    process.exit(0);
  }
  if (!WRITE) {
    console.log("dry run. re-run with --write to replace and create.");
    process.exit(0);
  }

  const removed = await clearMatrix();
  if (removed) console.log("cleared " + removed + " games from the previous matrix\n");

  for (const m of MATRIX) {
    const teams = roster();
    const { doc, kickoff } = game({
      label: m.label,
      kickoffOffsetMin: m.kickoffOffsetMin,
      duration: m.duration,
      teams,
    });

    const ref = await db.collection("games").add(doc);
    const events = eventsFor(m.points, kickoff);
    for (const e of events) {
      await ref.collection("live_events").add(e);
    }
    console.log(`  created ${ref.id}  ${m.label}  (${events.length} events)`);
  }

  console.log("\ndone. open the app as Tim and pull to refresh.");
  process.exit(0);
})();
