// The seeded matrix's game ids, with the facts the action bar branches on.
//
// There is no tap driver on this Mac, so reaching a given game sheet means
// pointing nav.dart's initialLocation at /game/<id>. This prints which id is
// which, and what the bar SHOULD show, so a screenshot can be judged rather
// than guessed at.
//
// READ-ONLY.
//
//   node list_test_game_ids.js
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

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";

// Mirrors gameSheetBarCase in the app, so this says what to EXPECT on screen.
function expected(g, timeRef) {
  const teams = g.teams || [];
  const free = teams.filter((s) => !s.user_id && !s.plus_one).length;
  const maxP = g.max_players || 0;
  const taken = teams.filter((s) => s.user_id).length;
  const isFull = maxP > 0 && taken >= maxP;
  const isMine = teams.some((s) => s.user_id === TIM && !s.plus_one);
  const isFollowing =
    !isMine && (g.interested || []).some((r) => r && r.id === TIM);
  const played = g.status === "played";
  const canceled = g.status === "canceled" || g.status === "hidden";
  const hasResult = Array.isArray(g.score_proposals) && g.score_proposals.length > 0;
  const kickedOff = g.date && g.date.toDate && g.date.toDate() < timeRef;

  if (canceled) return "share (cancelled)";
  if (played) {
    if (!isMine) return "share (not mine)";
    return hasResult ? "SEE CARD" : "ADD SCORE";
  }
  if (isFollowing && isFull) return "UNFOLLOW";
  if (isMine && isFull && !kickedOff) return "DIRECTIONS";
  return "share";
}

async function main() {
  const snap = await db
    .collection("games")
    .where("is_test_game", "==", true)
    .get();

  const now = new Date();
  const rows = [];
  snap.forEach((d) => {
    const g = d.data();
    if (g.centre !== "VSD39 Dole") return;
    rows.push({
      id: d.id,
      date: g.date && g.date.toDate ? g.date.toDate() : null,
      sport: g.sport,
      status: g.status,
      exp: expected(g, now),
    });
  });

  rows.sort((a, b) => (a.date && b.date ? a.date - b.date : 0));

  console.log("Seeded games at VSD39 Dole, and what the bar should show:\n");
  for (const r of rows) {
    const when = r.date ? r.date.toISOString().slice(0, 16).replace("T", " ") : "?";
    // Only the interesting ones are worth opening by hand.
    const mark = r.exp === "share" || r.exp.startsWith("share (") ? "   " : "-> ";
    console.log(
      `${mark}${when}  ${String(r.sport).padEnd(6)} ${String(r.status).padEnd(9)} ` +
        `${r.exp.padEnd(18)} /game/${r.id}`
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
