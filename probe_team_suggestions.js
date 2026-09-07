// What would "Your Team" actually suggest, for a real user?
//
// READ-ONLY. Runs the same aggregation getTeamSuggestions does, against
// production, so the ranking can be judged on real data before the function is
// deployed and before any UI is built on it.
//
// The point is the +1 trap: a guest is stored as the HOST'S OWN
// DocumentReference repeated, so a naive count is ~3x wrong. This prints both
// numbers side by side so the difference is visible rather than asserted.
//
//   node probe_team_suggestions.js [uid]
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
const uid = process.argv[2] || TIM;
const MAX_GAMES = 120;

async function main() {
  const meRef = db.collection("users").doc(uid);
  const meSnap = await meRef.get();
  const me = meSnap.data() || {};
  console.log(`user: ${me.display_name || uid}\n`);

  const excluded = new Set([uid]);
  const addRefs = (arr) => {
    for (const r of arr || []) {
      if (r && r.id) excluded.add(r.id);
      else if (typeof r === "string") excluded.add(r);
    }
  };
  addRefs(me.friends);
  addRefs(me.pending_friends);
  addRefs(me.blocked_users);
  addRefs(me.dismissed_suggestions);

  const outgoing = await db
    .collection("users")
    .where("pending_friends", "array-contains", meRef)
    .select()
    .get();
  outgoing.forEach((d) => excluded.add(d.id));

  console.log(`already connected / pending / blocked: ${excluded.size - 1}`);
  console.log(`  friends            ${(me.friends || []).length}`);
  console.log(`  pending (incoming) ${(me.pending_friends || []).length}`);
  console.log(`  pending (outgoing) ${outgoing.size}`);
  console.log(`  dismissed          ${(me.dismissed_suggestions || []).length}\n`);

  const gamesSnap = await db
    .collection("games")
    .where("attendees", "array-contains", meRef)
    .where("status", "==", "played")
    .orderBy("date", "desc")
    .limit(MAX_GAMES)
    .get();

  const realGames = gamesSnap.docs.filter(
    (d) => (d.data() || {}).is_test_game !== true
  );
  const newestGameId = realGames.length ? realGames[0].id : null;
  console.log(`played games scanned: ${gamesSnap.size} (${realGames.length} real)\n`);

  const tally = new Map();
  let rawEntries = 0; // every attendee entry, +1 duplicates included
  let dedupedEntries = 0;

  realGames.forEach((doc) => {
    const g = doc.data();
    const seen = new Set();
    for (const ref of g.attendees || []) {
      const id = ref && ref.id;
      if (!id) continue;
      rawEntries++;
      if (seen.has(id) || excluded.has(id)) continue;
      seen.add(id);
      dedupedEntries++;

      const at = g.date && g.date.toDate ? g.date.toDate() : null;
      const prev = tally.get(id);
      if (prev) prev.count += 1;
      else
        tally.set(id, {
          count: 1,
          lastGameAt: at,
          lastGameId: doc.id,
          inLastGame: doc.id === newestGameId,
        });
    }
  });

  // THE TRAP, measured rather than asserted.
  const inflation = dedupedEntries ? (rawEntries / dedupedEntries) : 0;
  console.log(`attendee entries: ${rawEntries} raw -> ${dedupedEntries} after dedupe`);
  console.log(`  a naive count would be ${inflation.toFixed(1)}x too high\n`);

  const ranked = [...tally.entries()].sort((a, b) => {
    const at = a[1].lastGameAt ? a[1].lastGameAt.getTime() : 0;
    const bt = b[1].lastGameAt ? b[1].lastGameAt.getTime() : 0;
    if (bt !== at) return bt - at;
    return b[1].count - a[1].count;
  });

  console.log(`SUGGESTIONS: ${ranked.length} distinct teammates\n`);

  const top = ranked.slice(0, 10);
  const docs = top.length
    ? await db.getAll(...top.map(([id]) => db.collection("users").doc(id)))
    : [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i];
    const u = d.exists ? d.data() : {};
    const t = top[i][1];
    const reason = t.inLastGame
      ? "dans ton dernier match"
      : t.count >= 2
        ? `vous avez joué ${t.count} fois ensemble`
        : `dans ton match du ${t.lastGameAt ? t.lastGameAt.toISOString().slice(0, 10) : "?"}`;
    const flags = [];
    if (!d.exists) flags.push("NO USER DOC");
    if (u.banned === true) flags.push("BANNED - filtered");
    if (!u.display_name) flags.push("NO NAME");
    console.log(
      `  ${(u.display_name || d.id).padEnd(24)} ${String(t.count).padStart(2)}x  ${reason}` +
        (flags.length ? `   [${flags.join(", ")}]` : "")
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e.message);
  process.exit(1);
});
