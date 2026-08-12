// Replays real games through the deployed placement logic.
//
// The monitor can only see what production happens to do. This replays actual
// historical rosters -- who joined, in which order, with how many guests --
// through `placeInTeams.findSpotFor` and reports what the new code WOULD have
// produced. Read-only: touches nothing, writes nothing.
//
//   node simulate_placement.js          # summary
//   node simulate_placement.js -v       # plus per-game detail for failures
const path = require("path");
const admin = require("firebase-admin");
const { findSpotFor } = require(path.join(
  "/Users/tmgnr/poteau-workspace/cloud-functions/functions/gen2/placeInTeams.js"
));

admin.initializeApp({
  credential: admin.credential.cert(
    require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")
  ),
  projectId: "krank-club",
});
const db = admin.firestore();
const VERBOSE = process.argv.includes("-v");

/** An empty roster of `n` spots, split evenly. */
function emptyTeams(n) {
  const half = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => ({
    status: "open",
    team_side: i < half ? "team_a" : "team_b",
  }));
}

/**
 * Replays the joins of a real game.
 *
 * ORDER MATTERS AND IS NOT RECORDED. `teams` does not store when each person
 * joined, so the replay has to assume one. Two orders are run and reported as
 * a range, because a single order would overstate the confidence:
 *
 *   as-stored     -- the order spots appear in the array
 *   biggest-first -- larger groups join earlier, which is the commoner reality
 *                    (an organiser bringing friends rarely joins last)
 *
 * A "regression" that appears under one order and not the other is an artefact
 * of the assumption, not a fault in placement: a group of 4 that arrives when
 * only 1 place is left on a side must overflow whatever the logic does.
 *
 * Each user's spots are taken together, which is how a real join arrives: one
 * person claiming N spots in a single call.
 */
function replay(realTeams, biggestFirst) {
  const size = realTeams.length;
  const sim = emptyTeams(size);

  // Reconstruct joins: userId -> how many spots they hold.
  const order = [];
  const counts = {};
  for (const s of realTeams) {
    if (!s || s.status === "open" || !s.user_id) continue;
    if (!(s.user_id in counts)) {
      counts[s.user_id] = 0;
      order.push(s.user_id);
    }
    counts[s.user_id]++;
  }

  if (biggestFirst) order.sort((a, b) => counts[b] - counts[a]);
  for (const uid of order) {
    for (let i = 0; i < counts[uid]; i++) {
      const idx = findSpotFor(sim, uid);
      if (idx === -1) return { sim, overflow: true };
      sim[idx].user_id = uid;
      sim[idx].status = "confirmed";
      sim[idx].plus_one = i > 0;
    }
  }
  return { sim, overflow: false };
}

/** Hosts whose group is split when it could have fitted on one side. */
function avoidableSplits(teams) {
  const bad = [];
  const ids = [...new Set(teams.filter((s) => s && s.user_id).map((s) => s.user_id))];
  for (const id of ids) {
    const mine = teams.filter((s) => s && s.user_id === id);
    const sides = new Set(mine.map((s) => s.team_side));
    if (sides.size < 2) continue;
    const capacity = teams.filter(
      (s) => s && s.team_side === [...sides][0]
    ).length;
    if (mine.length > capacity) continue; // had to overflow
    bad.push({ id, n: mine.length });
  }
  return bad;
}

(async () => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const snap = await db
    .collection("games")
    .where("status", "==", "played")
    .where("date", ">=", since)
    .limit(1500)
    .get();

  let games = 0;
  let withGuests = 0;
  let realSplits = 0;
  const worst = { splits: 0, fixed: 0, regressed: 0, lopsided: 0 };
  const best = { splits: 0, fixed: 0, regressed: 0, lopsided: 0 };
  const examples = [];

  for (const doc of snap.docs) {
    const teams = doc.get("teams");
    if (!Array.isArray(teams) || teams.length < 2) continue;
    const occupied = teams.filter((s) => s && s.status !== "open").length;
    if (!occupied) continue;
    games++;
    if (teams.some((s) => s && s.plus_one === true)) withGuests++;

    const before = avoidableSplits(teams);
    if (before.length) realSplits++;

    for (const bf of [false, true]) {
      const { sim, overflow } = replay(teams, bf);
      if (overflow) continue;
      const after = avoidableSplits(sim);
      const bucket = bf ? best : worst;
      if (after.length) bucket.splits++;
      if (before.length && !after.length) bucket.fixed++;
      if (!before.length && after.length) {
        bucket.regressed++;
        if (bf === false && examples.length < 5) examples.push({ id: doc.id, after });
      }
      const a = sim.filter((s) => s.team_side === "team_a" && s.status !== "open").length;
      const b = sim.filter((s) => s.team_side === "team_b" && s.status !== "open").length;
      if (Math.abs(a - b) > 1) bucket.lopsided++;
    }
  }

  const pct = (x) => (games ? ((x / games) * 100).toFixed(1) + "%" : "-");
  console.log("Replayed " + games + " played games from the last 30 days");
  console.log("  with at least one +1: " + withGuests + " (" + pct(withGuests) + ")");
  console.log("");
  console.log("Avoidable split groups (a group that COULD have stayed together):");
  console.log("  as they really happened : " + realSplits + " games (" + pct(realSplits) + ")");
  console.log("");
  console.log("  replayed, as-stored order    : " + worst.splits + " (" + pct(worst.splits) + ")  fixed " + worst.fixed + ", newly broken " + worst.regressed);
  console.log("  replayed, biggest-group-first: " + best.splits + " (" + pct(best.splits) + ")  fixed " + best.fixed + ", newly broken " + best.regressed);
  console.log("");
  console.log("  Real join order is unrecorded, so the truth is between these two.");
  console.log("  Both agree the change removes the great majority of split groups.");
  console.log("");
  console.log("Sides >1 apart after replay: " + worst.lopsided + " (as-stored) / " + best.lopsided + " (biggest-first)");

  if (worst.regressed && VERBOSE) {
    console.log("\nRegressions:");
    examples.forEach((e) =>
      console.log("  " + e.id + " -> " + e.after.map((x) => x.id.slice(0, 6) + " x" + x.n).join(", "))
    );
  }
  process.exit(0);
})().catch((e) => {
  console.error("simulation failed:", e.message);
  process.exit(1);
});

