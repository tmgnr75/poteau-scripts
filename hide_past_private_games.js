// Hide Tim's PAST PRIVATE games.
//
// `hidden` and `canceled` are functionally identical -- both mean the game will
// not happen -- and differ only in that a `hidden` game also disappears from the
// organizer's own list. So this is a tidy-up of one person's history, not a
// state change anybody else can observe.
//
// SCOPE, deliberately narrow:
//   organizer == TIM      only his own games
//   visibility == private never a game other people could find
//   date < now            never a game that has not happened
//   status != hidden      idempotent; re-running changes nothing
//
// Test games are SEPARATE and skipped by default. Five of them belong to
// `live_test_matrix`, which seed_live_test_matrix.js recreates and which the
// Home test panel queries -- hiding those empties the panel. Pass --tests to
// include them anyway (the seeder's own --clean is usually what you want).
//
//   node hide_past_private_games.js            # dry run
//   node hide_past_private_games.js --write    # hide the real games
//   node hide_past_private_games.js --write --tests   # include test games
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

const WRITE = process.argv.includes("--write");
const WITH_TESTS = process.argv.includes("--tests");
const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";

(async () => {
  const now = new Date();
  const snap = await db.collection("games").where("organizer", "==", TIM).get();

  const rows = [];
  snap.forEach((d) => {
    const g = d.data();
    if (g.visibility !== "private") return;
    if (g.status === "hidden") return; // already done
    const dt = g.date && g.date.toDate ? g.date.toDate() : null;
    if (!dt || dt >= now) return; // never touch a future game
    rows.push({
      ref: d.ref,
      id: d.id,
      status: g.status,
      date: dt.toISOString().slice(0, 16),
      centre: g.centre || "",
      isTest: !!g.is_test_game,
      isMatrix: !!g.live_test_matrix,
    });
  });

  const real = rows.filter((r) => !r.isTest);
  const test = rows.filter((r) => r.isTest);
  const targets = WITH_TESTS ? rows : real;

  console.log(`Tim's past private games not already hidden: ${rows.length}`);
  console.log(`  real: ${real.length}   test: ${test.length}\n`);

  console.log("WILL HIDE:");
  targets.forEach((r) =>
    console.log(
      `  ${r.id}  ${r.status.padEnd(9)} ${r.date}  ${r.isMatrix ? "(matrix) " : ""}${r.centre.slice(0, 24)}`
    )
  );

  if (!WITH_TESTS && test.length) {
    console.log("\nSKIPPED (test games -- pass --tests to include):");
    test.forEach((r) =>
      console.log(`  ${r.id}  ${r.status.padEnd(9)} ${r.date}  ${r.isMatrix ? "(matrix)" : ""}`)
    );
  }

  if (!targets.length) {
    console.log("\nnothing to do.");
    process.exit(0);
  }
  if (!WRITE) {
    console.log("\ndry run. re-run with --write to apply.");
    process.exit(0);
  }

  // One at a time rather than a batch: the count is small, and a per-document
  // failure should not roll back the ones that already worked.
  let ok = 0;
  for (const r of targets) {
    try {
      await r.ref.update({ status: "hidden" });
      ok++;
    } catch (e) {
      console.error(`  FAILED ${r.id}: ${e.message}`);
    }
  }
  console.log(`\nhidden ${ok}/${targets.length}.`);
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
