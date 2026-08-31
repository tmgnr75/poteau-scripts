// Has a result ever been settled on a REAL game, in either sport?
//
// The backfill dry-run PRINTS "no game carries proposals yet", but that string
// is hardcoded, not measured. This measures it.
//
// Why it matters for 5.2.0: stats only move when a game carries an agreed
// score_proposal. If nothing in production has ever carried one, then the whole
// result -> stats path has never run on real data, and "the columns read 0" has
// a cause upstream of the engine that was just deployed.
//
// READ-ONLY.
//
//   node audit_score_proposals.js
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

async function main() {
  // score_proposals is an array; a non-empty one sorts after an empty one, but
  // Firestore cannot query "array is non-empty" directly. Order by the field
  // instead: docs missing it are excluded, which is exactly what we want.
  const snap = await db
    .collection("games")
    .orderBy("score_proposals")
    .limit(1000)
    .get()
    .catch((e) => {
      console.log("orderBy(score_proposals) failed:", e.message);
      return null;
    });

  if (!snap) return;

  console.log(`games carrying a score_proposals field: ${snap.size}`);

  const withProposals = snap.docs.filter((d) => {
    const p = d.get("score_proposals");
    return Array.isArray(p) && p.length > 0;
  });

  console.log(`games with a NON-EMPTY score_proposals: ${withProposals.length}\n`);

  const rows = withProposals.map((d) => {
    const g = d.data();
    const props = g.score_proposals || [];
    // A result is SETTLED when a proposal has enough agreement. Report the raw
    // shape rather than re-deriving the rule, so this cannot drift from it.
    // There is NO fixed threshold: resolvedScore picks the proposal with the
    // most agreements, so one agreement is enough to settle a lone proposal.
    // What actually matters is the writer's contract -- the proposer MUST be
    // inside agreed_by -- which nothing server-side can enforce.
    const settled = props.filter(
      (p) => Array.isArray(p.agreed_by) && p.agreed_by.length > 0
    ).length;
    const contractBroken = props.filter(
      (p) =>
        p.proposed_by &&
        !(Array.isArray(p.agreed_by) ? p.agreed_by : []).includes(p.proposed_by)
    ).length;
    return {
      id: d.id,
      sport: g.sport === "padel" ? "padel" : "soccer",
      test: g.is_test_game === true,
      date:
        g.date && g.date.toDate
          ? g.date.toDate().toISOString().slice(0, 10)
          : "?",
      status: g.status || "",
      n: props.length,
      settled,
      contractBroken,
      centre: g.centre || "",
    };
  });

  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  const real = rows.filter((r) => !r.test);
  const test = rows.filter((r) => r.test);

  console.log(`REAL games with proposals: ${real.length}`);
  console.log(`  soccer: ${real.filter((r) => r.sport === "soccer").length}`);
  console.log(`  padel : ${real.filter((r) => r.sport === "padel").length}`);
  console.log(`TEST games with proposals: ${test.length}\n`);

  const show = (label, list) => {
    if (!list.length) return;
    console.log(`--- ${label} ---`);
    for (const r of list.slice(0, 30)) {
      console.log(
        `${r.date}  ${r.sport.padEnd(6)}  ${r.status.padEnd(10)}  ` +
          `${r.n} prop, ${r.settled} agreed, ${r.contractBroken} BROKEN  ${r.id}  ${r.centre}`
      );
    }
    console.log("");
  };

  show("REAL", real);
  show("TEST", test);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
