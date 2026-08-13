// One game per STATE OF THE CARD, so the redesign can be judged on a real screen.
//
// seed_live_test_matrix.js covers the Live window states and always builds a full
// 10-a-side roster. This one covers the states the CARD has to render — which are
// mostly about how full a game is, because that is what Poteau games actually vary
// on: only 40 of 4,000 games ever reach full, and 1,373 have nobody in them at all.
//
// Every kickoff is anchored to `now` at run time, so re-running gives fresh windows.
// Re-running REPLACES the previous set (tagged `card_state_matrix`), so it never
// accumulates.
//
// SAFETY, same as the Live matrix:
//   visibility   private    -- cannot surface in anyone's feed or alerts
//   is_test_game true       -- findable and deletable
//   payment_type on-site    -- never touches Stripe
//   attendees    test accounts only, plus Tim
//
//   node seed_card_states.js           # dry run
//   node seed_card_states.js --write   # replace and create
//   node seed_card_states.js --clean   # delete them, create nothing
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

const WRITE = process.argv.includes("--write");
const CLEAN = process.argv.includes("--clean");
const TAG = "card_state_matrix";

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2"; // gold -> badge on the card
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";
const LIAM = "Go2YXYj9FFW6xG28HZNBcrDkIJV2";
const SOPHIE = "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2";
const TODD = "xz7cm07tVlZkt71QsLdmeTSCPYI3";
const ZAMUEL = "fQCEL4nvfxQ6N7na61ARPt4wDCl1";

const MIN = 60 * 1000;
const POOL = [TIM, GINA, MARCO, LUCIA, NOAH, LIAM, SOPHIE, TODD, ZAMUEL];

/// Builds `teams` with `filled` occupied spots out of `maxPlayers`.
///
/// Tim is always FIRST when there is anybody at all, so every seeded game shows up
/// on his Home — the card states are judged from his account.
function roster(filled, maxPlayers) {
  const spots = [];
  for (let i = 0; i < maxPlayers; i++) {
    const side = i < Math.ceil(maxPlayers / 2) ? "team_a" : "team_b";
    if (i < filled) {
      spots.push({
        team_side: side,
        user_id: POOL[i % POOL.length],
        plus_one: false,
        status: "confirmed",
        spot_number: i + 1,
      });
    } else {
      // An OPEN spot: no user, which is what freeSpots() counts.
      spots.push({
        team_side: side,
        user_id: "",
        plus_one: false,
        status: "open",
        spot_number: i + 1,
      });
    }
  }
  return spots;
}

function game({ label, offsetMin, filled, maxPlayers = 10, duration = 60, extra = {} }) {
  const kickoff = new Date(Date.now() + offsetMin * MIN);
  const teams = roster(filled, maxPlayers);
  const attendees = teams
    .filter((s) => s.user_id)
    .map((s) => db.collection("users").doc(s.user_id));
  return {
    kickoff,
    doc: {
      address: "VSD39 Dole",
      centre: "VSD39 Dole",
      reservation_name: label,
      place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
      location: new GeoPoint(47.10255979999999, 5.5016487),
      date: Timestamp.fromDate(kickoff),
      end_time: Timestamp.fromDate(new Date(kickoff.getTime() + duration * MIN)),
      duration,
      max_players: maxPlayers,
      mood: "chill",
      organizer: TIM,
      type: "captain",
      price: 8,
      price_undiscounted: 8,
      currency: "EUR",
      visibility: "private",
      players_to_find: maxPlayers - filled,
      sport: "soccer",
      payment_type: "on-site",
      time_zone: "Europe/Paris",
      country_code: "FR",
      level_deltas: ["five_six"],
      gold_exclusive: false,
      status: "published",
      poteau_live: true,
      is_test_game: true,
      [TAG]: true,
      created_on: Timestamp.now(),
      teams,
      attendees,
      interested: [],
      messages: [],
      outsiders: [],
      ...extra,
    },
  };
}

// THE CARD STATES, in the order the artifact presents them.
//
// Kickoffs are spaced so no two land on the same minute, and the future ones sit far
// enough out that gameStatusUpdater cannot touch them mid-session.
const STATES = [
  { label: "A · Vide — l'offre", offsetMin: 3000, filled: 0,
    note: "0 players. NO roster row: price/level fill the space." },
  { label: "B · Un seul joueur", offsetMin: 2880, filled: 1,
    note: "The first joiner. Circles begin here." },
  { label: "C · Trois joueurs", offsetMin: 2760, filled: 3,
    note: "3/10 — the common shape. 7 places libres." },
  { label: "D · Presque complet", offsetMin: 2640, filled: 8,
    note: "8/10. The row is nearly solid." },
  { label: "E · Complet — Live annoncé", offsetMin: 2520, filled: 10,
    note: "Full, far out. Grey band: Poteau Live à HH:MM." },
  { label: "F · Grand format (22)", offsetMin: 2400, filled: 19, maxPlayers: 22,
    note: "The wrap case: 19 faces + 3 open on a 22-player game." },
  { label: "G · Terminé sans score", offsetMin: -200, filled: 10,
    note: "Played, no score. The dashes + 'Ajouter le score'.",
    extra: { status: "played" } },
  { label: "H · Terminé avec score", offsetMin: -260, filled: 10,
    note: "Played with a result. Score in the band.",
    extra: {
      status: "played",
      score_proposals: [{
        periods: [{ team_a: 4, team_b: 2 }],
        proposed_by: TIM,
        proposed_at: Timestamp.now(),
        agreed_by: [TIM, MARCO],
      }],
      // `winning_side`, NOT `result` — see the note in
      // seed_live_test_matrix.js. `result:` is a key no reader understands, so
      // the game counts as scored but NOT resulted, breaking the denominator
      // nesting and firing a spurious drift alert. Match the app's shape
      // (ResultProposalStruct), never invent one.
      result_proposals: [{
        winning_side: "team_a", is_draw: false, proposed_by: TIM,
        proposed_at: Timestamp.now(), agreed_by: [TIM, MARCO],
      }],
    } },
  { label: "I · Annulé", offsetMin: 2280, filled: 4,
    note: "Red band, no roster row, 'Retirer ce match'.",
    extra: { status: "canceled" } },
];

async function clear() {
  const snap = await db.collection("games").where(TAG, "==", true).get();
  for (const d of snap.docs) {
    const ev = await d.ref.collection("live_events").get();
    for (const e of ev.docs) await e.ref.delete();
    await d.ref.delete();
  }
  return snap.size;
}

(async () => {
  console.log("CARD STATES — one game per state of the redesigned card");
  console.log("all private · is_test_game · on-site · VSD39 Dole\n");
  for (const s of STATES) {
    const max = s.maxPlayers || 10;
    console.log(`  ${s.label}`);
    console.log(`      ${s.filled}/${max} players — ${s.note}`);
  }
  console.log("");

  if (CLEAN) {
    console.log(`deleted ${await clear()} games. nothing created.`);
    process.exit(0);
  }
  if (!WRITE) {
    console.log("dry run. re-run with --write to replace and create.");
    process.exit(0);
  }

  const removed = await clear();
  if (removed) console.log(`cleared ${removed} from the previous run\n`);

  for (const s of STATES) {
    const { doc } = game(s);
    const ref = await db.collection("games").add(doc);
    console.log(`  created ${ref.id}  ${s.label}`);
  }
  console.log("\ndone.");
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
