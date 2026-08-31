// Has Poteau Live ever actually been used on a REAL game?
//
// The 5.2.0 ship/hold call rests on this. The scorer's correctness is proven by
// 33 shared fixtures passing in both Dart and JS; what no test can prove is
// whether anybody has ever recorded a real match with it, and whether padel in
// particular has ever left the simulator.
//
// READ-ONLY. Writes nothing, ever.
//
//   node audit_live_usage.js
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

// The same fold the app and the engine run, so a score reported here is the
// score that was actually on screen.
const { foldLiveScore } = require(path.join(
  "/Users/tmgnr/poteau-workspace/cloud-functions/functions",
  "gen2/foldLiveScore"
));

// A live game is one that HAS a live_events subcollection with points in it.
// There is no top-level flag to query, so this walks games that carry the
// markers Live writes, then confirms by reading the subcollection.
async function main() {
  console.log("Scanning games for Live activity (read-only)...\n");

  // Live writes live_opened_at when the scoreboard opens and live_scored_at on
  // the first point. Querying those directly beats sweeping every game.
  const seen = new Map();
  for (const field of ["live_opened_at", "live_scored_at"]) {
    const snap = await db
      .collection("games")
      .orderBy(field, "desc")
      .limit(2000)
      .get()
      .catch((e) => {
        console.log(`  (${field} query failed: ${e.message})`);
        return null;
      });
    if (snap) {
      console.log(`games with ${field}: ${snap.size}`);
      for (const d of snap.docs) seen.set(d.id, d);
    }
  }
  const candidates = [...seen.values()];
  console.log(`distinct candidate games: ${candidates.length}`);

  const rows = [];
  // Read each candidate's event log. Batched by hand to keep reads bounded.
  for (const doc of candidates) {
    const ev = await doc.ref.collection("live_events").limit(500).get();
    if (ev.empty) continue;

    const g = doc.data();
    const events = ev.docs.map((d) => d.data());
    const points = events.filter((e) => e.type === "point").length;
    const sport = g.sport === "padel" ? "padel" : "soccer";

    let scoreline = "";
    try {
      const s = foldLiveScore(events, sport);
      // JS nests the score under matchScore; Dart exposes a/b at the top level.
      const m = s.matchScore || {};
      scoreline = `${m.a}-${m.b} ${m.unit || ""}`.trim();
    } catch (e) {
      scoreline = `FOLD FAILED: ${e.message}`;
    }

    rows.push({
      id: doc.id,
      sport,
      test: g.is_test_game === true,
      date: g.date && g.date.toDate ? g.date.toDate().toISOString().slice(0, 10) : "?",
      events: events.length,
      points,
      scoreline,
      centre: g.centre || "",
    });
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const real = rows.filter((r) => !r.test);
  const test = rows.filter((r) => r.test);

  console.log(`\n=== GAMES WITH A LIVE EVENT LOG: ${rows.length} ===`);
  console.log(`  real: ${real.length}   test: ${test.length}`);

  const realPadel = real.filter((r) => r.sport === "padel");
  const realSoccer = real.filter((r) => r.sport === "soccer");
  console.log(`\n  REAL soccer: ${realSoccer.length}`);
  console.log(`  REAL padel : ${realPadel.length}   <-- the ship/hold number`);

  const show = (label, list) => {
    if (!list.length) return;
    console.log(`\n--- ${label} ---`);
    for (const r of list.slice(0, 25)) {
      console.log(
        `${r.date}  ${r.sport.padEnd(6)}  ${String(r.points).padStart(4)} pts  ` +
          `${r.scoreline.padEnd(14)}  ${r.id}  ${r.centre}`
      );
    }
  };

  show("REAL padel games with Live events", realPadel);
  show("REAL soccer games with Live events", realSoccer);
  show("test games with Live events", test.slice(0, 10));

  // A fold that throws in production is the one failure that would be visible
  // to players, so call it out separately from the counts.
  const broken = rows.filter((r) => r.scoreline.startsWith("FOLD FAILED"));
  if (broken.length) {
    console.log(`\n!!! ${broken.length} game(s) whose event log does not fold:`);
    for (const r of broken) console.log(`   ${r.id}  ${r.scoreline}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
