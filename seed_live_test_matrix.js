// The whole Poteau Live experience, as a set of games — one per state.
//
// Built for a testing session where the point is to LOOK at every state in a
// row and say "that one is wrong", rather than to seed one game and then spend
// the morning editing timestamps to move it between states.
//
// Every game is anchored to `now` at run time, so re-running it in the morning
// gives fresh windows. Re-running also REPLACES the previous matrix (games are
// tagged `live_test_matrix`), so it never accumulates junk.
//
// SAFETY, inherited from create_live_teams_test_game.js:
//   visibility   private    -- cannot surface in anyone's feed or alerts
//   is_test_game true       -- findable and deletable
//   payment_type on-site    -- never touches Stripe
//   attendees    test accounts only, plus Tim
//
//   node seed_live_test_matrix.js           # dry run, prints the matrix
//   node seed_live_test_matrix.js --write   # replace and create
//   node seed_live_test_matrix.js --clean   # delete the matrix, create nothing
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
const { Timestamp, GeoPoint, FieldValue } = admin.firestore;

const WRITE = process.argv.includes("--write");
const CLEAN = process.argv.includes("--clean");

// Marks every game this script owns, so a re-run can clear the last one.
const MATRIX_TAG = "live_test_matrix";

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2"; // gold_status -> badge on the card
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";
const LIAM = "Go2YXYj9FFW6xG28HZNBcrDkIJV2";
const SOPHIE = "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2";

const MIN = 60 * 1000;

// A full 10-spot roster with guests sitting beside their host, which is what
// placement now guarantees. Tim is a MIDFIELDER here and Marco is the keeper on
// his side, so the clean-sheet rule has a real subject that is not the viewer —
// and a separate game below puts Tim in goal so the viewer can see his own.
function roster({ timInGoal = false } = {}) {
  const spots = [
    { team_side: "team_a", user_id: TIM, plus_one: false, position: timInGoal ? "goalkeeper" : "midfielder" },
    { team_side: "team_a", user_id: TIM, plus_one: true },
    { team_side: "team_a", user_id: TIM, plus_one: true },
    { team_side: "team_a", user_id: GINA, plus_one: false, position: "forward" },
    { team_side: "team_a", user_id: MARCO, plus_one: false, position: timInGoal ? "defender" : "goalkeeper" },
    { team_side: "team_b", user_id: LUCIA, plus_one: false, position: "defender" },
    { team_side: "team_b", user_id: LUCIA, plus_one: true },
    { team_side: "team_b", user_id: NOAH, plus_one: false, position: "midfielder" },
    { team_side: "team_b", user_id: LIAM, plus_one: false, position: "forward" },
    { team_side: "team_b", user_id: SOPHIE, plus_one: false, position: "goalkeeper" },
  ];
  return spots.map((s, i) => ({ spot_number: i + 1, status: "confirmed", ...s }));
}

function game({ label, kickoffOffsetMin, duration = 60, teams, extra = {} }) {
  const kickoff = new Date(Date.now() + kickoffOffsetMin * MIN);
  return {
    doc: {
      address: "VSD39 Dole",
      centre: "VSD39 Dole",
      reservation_name: label,
      place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
      location: new GeoPoint(47.10255979999999, 5.5016487),
      date: Timestamp.fromDate(kickoff),
      end_time: Timestamp.fromDate(new Date(kickoff.getTime() + duration * MIN)),
      duration,
      max_players: 10,
      mood: "chill",
      organizer: TIM,
      type: "captain",
      price: 0,
      currency: "EUR",
      visibility: "private",
      players_to_find: 0,
      sport: "soccer",
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
      ...extra,
    },
    kickoff,
  };
}

// THE MATRIX.
//
// Ordered the way the experience runs, not by convenience: a game far out, then
// one about to open, then one open, then one being played, then the three
// end-states. Kickoffs are spaced so no two land on the same minute — the
// test-entry card picks by nearest kickoff, and a tie makes the wrong game win.
const MATRIX = [
  {
    label: "1 · Loin — Live pas encore annoncé",
    kickoffOffsetMin: 240,
    note: "T-4h. Home card and game sheet BEFORE any Live hint.",
  },
  {
    label: "2 · Bientôt — Live s'ouvre dans 5 min",
    kickoffOffsetMin: 35,
    note: "T-35. Just OUTSIDE the T-30 window: the 'Live is coming' state.",
  },
  {
    label: "3 · Fenêtre ouverte — avant le coup d'envoi",
    kickoffOffsetMin: 20,
    note: "T-20. Inside T-30, before kickoff. Live is open, teams unconfirmed.",
  },
  {
    label: "4 · En cours — équipes déjà confirmées",
    kickoffOffsetMin: -25,
    note: "Started 25 min ago. Teams confirmed, so Live opens on the board.",
    confirmTeams: true,
  },
  {
    label: "5 · Fin de match — TERMINER visible",
    kickoffOffsetMin: -52,
    note: "T-8 before the booked end: the finish button is on the board.",
    confirmTeams: true,
    withGoals: true,
  },
  {
    label: "6 · Terminé sans résultat — on doit demander",
    kickoffOffsetMin: -120,
    note: "Played, NO result proposal. This is the full-screen ask.",
    played: true,
  },
  {
    label: "7 · Résultat sans score — carte partageable",
    kickoffOffsetMin: -150,
    note: "Result only, no score. The COMMON card: match carries it.",
    played: true,
    resultOnly: true,
  },
  {
    label: "8 · Score complet — carte riche",
    kickoffOffsetMin: -180,
    note: "Live-recorded, score + scorers. Hat-trick for Tim, clean sheet.",
    played: true,
    fullScore: true,
    timInGoal: false,
  },
];

async function clearMatrix() {
  const snap = await db.collection("games").where(MATRIX_TAG, "==", true).get();
  if (snap.empty) return 0;
  // Delete the live_events subcollection too, or a re-run inherits old goals.
  for (const d of snap.docs) {
    const ev = await d.ref.collection("live_events").get();
    for (const e of ev.docs) await e.ref.delete();
    await d.ref.delete();
  }
  return snap.size;
}

(async () => {
  const names = {};
  for (const id of [TIM, GINA, MARCO, LUCIA, NOAH, LIAM, SOPHIE]) {
    const u = await db.collection("users").doc(id).get();
    names[id] = u.exists ? u.get("display_name") : "?";
  }

  console.log("POTEAU LIVE — test matrix at VSD39 Dole");
  console.log("all private · is_test_game · on-site · poteau_live\n");
  for (const m of MATRIX) {
    const at = new Date(Date.now() + m.kickoffOffsetMin * MIN);
    const rel =
      m.kickoffOffsetMin >= 0
        ? "in " + m.kickoffOffsetMin + " min"
        : Math.abs(m.kickoffOffsetMin) + " min ago";
    console.log("  " + m.label);
    console.log("      kickoff " + at.toTimeString().slice(0, 5) + " (" + rel + ") — " + m.note);
  }
  console.log("");

  if (CLEAN) {
    const n = await clearMatrix();
    console.log("deleted " + n + " matrix games. nothing created.");
    process.exit(0);
  }
  if (!WRITE) {
    console.log("dry run. re-run with --write to replace and create.");
    process.exit(0);
  }

  const removed = await clearMatrix();
  if (removed) console.log("cleared " + removed + " games from the previous matrix\n");

  for (const m of MATRIX) {
    const teams = roster({ timInGoal: !!m.timInGoal });
    const { doc, kickoff } = game({
      label: m.label,
      kickoffOffsetMin: m.kickoffOffsetMin,
      teams,
    });

    if (m.confirmTeams) doc.live_teams_confirmed_at = Timestamp.fromDate(new Date(kickoff.getTime() - 5 * MIN));
    if (m.played) doc.status = "played";

    // A result with NO score: exactly the shape the common card must render.
    //
    // THE KEY IS `winning_side`, NOT `result`. Both this file and
    // seed_card_states.js wrote `result:` until 2026-08-13, which is a key that
    // exists in neither ResultProposalStruct nor recomputeUserStats. The
    // derivation read `winning_side`/`is_draw`, found neither, took the
    // malformed branch and counted the game as having NO result — while the
    // score still counted — producing `games_with_score=1 > games_with_result=0`
    // and a [DENOMINATOR_VIOLATION] on every seeded user.
    //
    // It also cost a morning: the stale blocks showed up as a `games_with_score
    // 1->0` drift alert that looked like a production bug and was not.
    //
    // Seeds must write the shape the APP writes. A seed that invents its own
    // shape tests nothing and actively misleads — see
    // poteau-app/lib/backend/schema/structs/result_proposal_struct.dart.
    // `is_draw` is explicit so a proposed draw is never an unset result.
    if (m.resultOnly) {
      doc.result_proposals = [
        {
          winning_side: "team_a",
          is_draw: false,
          proposed_by: TIM,
          proposed_at: Timestamp.now(),
          agreed_by: [TIM],
        },
      ];
    }

    // A full live-recorded match: score proposal AND the event log behind it.
    if (m.fullScore) {
      doc.score_proposals = [
        {
          periods: [{ team_a: 4, team_b: 0 }],
          proposed_by: TIM,
          proposed_at: Timestamp.now(),
          agreed_by: [TIM, MARCO],
        },
      ];
      doc.result_proposals = [
        {
          winning_side: "team_a",
          is_draw: false,
          proposed_by: TIM,
          proposed_at: Timestamp.now(),
          agreed_by: [TIM, MARCO],
        },
      ];
    }

    const ref = await db.collection("games").add(doc);

    // Goals, as real appended events, so the fold and the history read them the
    // same way they read a genuine match. 4-0: a hat-trick for Tim (rank 1) and
    // one for Gina, with Sophie's side conceding — so Marco keeps a clean sheet.
    if (m.withGoals || m.fullScore) {
      const goals = [
        { min: 7, side: "team_a", scorer: TIM },
        { min: 19, side: "team_a", scorer: GINA },
        { min: 34, side: "team_a", scorer: TIM },
        { min: 51, side: "team_a", scorer: TIM },
      ];
      for (const g of goals) {
        const cid = "seed_" + ref.id + "_" + g.min;
        await ref.collection("live_events").add({
          type: "point",
          side: g.side,
          created_by: TIM,
          created_at: Timestamp.fromDate(new Date(kickoff.getTime() + g.min * MIN)),
          client_at: new Date(kickoff.getTime() + g.min * MIN),
          client_event_id: cid,
        });
        await ref.collection("live_events").add({
          type: "attribution",
          attributes: cid,
          scorer_id: g.scorer,
          created_by: TIM,
          created_at: Timestamp.fromDate(new Date(kickoff.getTime() + g.min * MIN + 5000)),
          client_at: new Date(kickoff.getTime() + g.min * MIN + 5000),
          client_event_id: cid + "_attr",
        });
      }
      await ref.update({ live_opened_at: Timestamp.fromDate(new Date(kickoff.getTime() - 5 * MIN)) });
    }

    console.log("  created " + ref.id + "  " + m.label);
  }

  console.log("\ndone. re-run any time to reset the windows.");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
