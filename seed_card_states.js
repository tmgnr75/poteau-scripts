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

// NEVER PUT A REAL ACCOUNT IN A SEEDED GAME.
//
// This pool used to end with Zamuel's REAL uid (fQCEL4nvfxQ6N7na61ARPt4wDCl1,
// zamu.puertas@gmail.com, is_test_account: false) -- a real ambassador who
// appeared in Tim's test games on 2026-08-14. Every uid here must be an account
// whose `is_test_account` is true; the assertion below enforces it at run time
// rather than trusting this comment.
const MIN = 60 * 1000;
const POOL = [TIM, GINA, MARCO, LUCIA, NOAH, LIAM, SOPHIE, TODD];

/// Builds `teams` with `filled` occupied spots out of `maxPlayers`.
///
/// Tim is always FIRST when there is anybody at all, so every seeded game shows up
/// on his Home — the card states are judged from his account.
function roster(filled, maxPlayers) {
  const spots = [];
  for (let i = 0; i < maxPlayers; i++) {
    const side = i < Math.ceil(maxPlayers / 2) ? "team_a" : "team_b";
    // Beyond the pool, spots are filled as PLUS-ONES rather than by wrapping
    // round the pool again.
    //
    // `POOL[i % POOL.length]` put Tim on the pitch twice (2026-08-14): the same
    // person in two spots is a visible bug. But leaving them open was wrong the
    // other way -- a "full" 10-a-side state stopped being full, so the FULL
    // band never rendered on it.
    //
    // A plus-one IS the same user ref repeated, by design: it is a spot, not a
    // person (see the attendees/plus_one trap in FIRESTORE_ANALYTICS_GUIDE.md).
    // So this is the real data shape, not a workaround.
    if (i < filled) {
      const beyondPool = i >= POOL.length;
      spots.push({
        team_side: side,
        user_id: beyondPool ? POOL[i % POOL.length] : POOL[i],
        plus_one: beyondPool,
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

function game({ label, offsetMin, filled, maxPlayers = 10, duration = 60, sport = "soccer", extra = {} }) {
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
      sport,
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

  // PADEL. The 4-player roster is the case the card has to get right at least
  // as much as 10-a-side -- a 22-player game is the rare edge, padel is not.
  //
  // These carry poteau_live: true like everything else (Tim, 2026-08-14). They
  // were seeded false on the reasoning that Live is soccer-only, which made a
  // full padel game render a band with nothing on its right-hand side and look
  // broken. EVERY SEEDED GAME IS LIVE: from 5.2.0 the flag stops being a
  // per-game pilot switch, so a fixture that is not Live is not a real fixture.
  { label: "P1 · Padel vide", offsetMin: 2160, filled: 0, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "0/4. Pure offer: no roster row at all." },
  { label: "P2 · Padel 1 joueur", offsetMin: 2040, filled: 1, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "1/4. One face, three open spots. The narrowest real roster." },
  { label: "P3 · Padel 2 joueurs", offsetMin: 1920, filled: 2, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "2/4. Half full -- the survival cliff for a padel game." },
  { label: "P4 · Padel 3 joueurs", offsetMin: 1800, filled: 3, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "3/4. One spot left, the highest-intent state." },
  { label: "P5 · Padel complet", offsetMin: 1680, filled: 4, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "4/4. Full: band says COMPLET, no count under the roster." },
  { label: "P6 · Padel joué", offsetMin: -320, filled: 4, maxPlayers: 4,
    sport: "padel", duration: 90,
    note: "Played padel, no score. Dashes + 'Ajouter le score'.",
    extra: { status: "played" } },
];

/// Refuses to seed if ANY pool member is not a test account.
///
/// A comment saying "test accounts only" did not stop a real ambassador ending
/// up in Tim's games. This reads the actual user docs and aborts before writing
/// anything, so the only way to reintroduce a real person is to also delete
/// this check.
async function assertPoolIsAllTestAccounts() {
  const bad = [];
  for (const uid of new Set(POOL)) {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists) {
      bad.push(`${uid} (no such user)`);
      continue;
    }
    const u = snap.data();
    // Tim is the one intentional exception: these are HIS games and he has to
    // appear on them to see them on his own Home.
    if (uid === TIM) continue;
    if (u.is_test_account !== true) {
      bad.push(`${uid} (${u.email || "no email"} — ${u.display_name || "?"})`);
    }
  }
  if (bad.length) {
    console.error("REFUSING TO SEED — real accounts in the pool:");
    bad.forEach((b) => console.error(`  ${b}`));
    console.error("\nEvery pool uid must have is_test_account: true.");
    process.exit(1);
  }
}

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

  await assertPoolIsAllTestAccounts();

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
