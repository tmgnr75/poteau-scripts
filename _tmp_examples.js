// Concrete before/after: real games that had an avoidable split, shown as
// they happened and as the new placement would have arranged them.
const path = require("path");
const admin = require("firebase-admin");
const { findSpotFor } = require(path.join(
  "/Users/tmgnr/poteau-workspace/cloud-functions/functions/gen2/placeInTeams.js"
));
admin.initializeApp({
  credential: admin.credential.cert(require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
  projectId: "krank-club",
});
const db = admin.firestore();

function emptyTeams(n) {
  const half = Math.floor(n / 2);
  return Array.from({ length: n }, (_, i) => ({
    status: "open", team_side: i < half ? "team_a" : "team_b",
  }));
}
function replay(realTeams) {
  const sim = emptyTeams(realTeams.length);
  const order = [], counts = {};
  for (const s of realTeams) {
    if (!s || s.status === "open" || !s.user_id) continue;
    if (!(s.user_id in counts)) { counts[s.user_id] = 0; order.push(s.user_id); }
    counts[s.user_id]++;
  }
  order.sort((a, b) => counts[b] - counts[a]);
  for (const uid of order) {
    for (let i = 0; i < counts[uid]; i++) {
      const idx = findSpotFor(sim, uid);
      if (idx === -1) return null;
      sim[idx].user_id = uid; sim[idx].status = "confirmed"; sim[idx].plus_one = i > 0;
    }
  }
  return sim;
}
function splits(teams) {
  const out = [];
  const ids = [...new Set(teams.filter(s => s && s.user_id).map(s => s.user_id))];
  for (const id of ids) {
    const mine = teams.filter(s => s && s.user_id === id);
    const sides = new Set(mine.map(s => s.team_side));
    if (sides.size < 2) continue;
    const cap = teams.filter(s => s && s.team_side === [...sides][0]).length;
    if (mine.length > cap) continue;
    out.push(id);
  }
  return out;
}
const row = (teams, side, names) =>
  teams.filter(s => s && s.team_side === side)
    .map(s => s.status === "open" ? "·····" : ((names[s.user_id] || "?").slice(0, 5) + (s.plus_one ? "+" : " ")))
    .join(" | ");

(async () => {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const snap = await db.collection("games").where("status", "==", "played")
    .where("date", ">=", since).limit(900).get();

  let shown = 0;
  for (const doc of snap.docs) {
    if (shown >= 3) break;
    const teams = doc.get("teams");
    if (!Array.isArray(teams) || teams.length < 8) continue;
    const before = splits(teams);
    if (!before.length) continue;
    const sim = replay(teams);
    if (!sim || splits(sim).length) continue;

    const ids = [...new Set(teams.filter(s => s && s.user_id).map(s => s.user_id))];
    const names = {};
    for (const id of ids) {
      const u = await db.collection("users").doc(id).get();
      names[id] = u.exists ? (u.get("display_name") || id.slice(0, 5)) : id.slice(0, 5);
    }
    shown++;
    console.log("### " + doc.id + "  (" + (doc.get("centre") || "?") + ")");
    console.log("    split group: " + before.map(i => names[i]).join(", "));
    console.log("  BEFORE  A: " + row(teams, "team_a", names));
    console.log("          B: " + row(teams, "team_b", names));
    console.log("  AFTER   A: " + row(sim, "team_a", names));
    console.log("          B: " + row(sim, "team_b", names));
    console.log("");
  }
  process.exit(0);
})();
