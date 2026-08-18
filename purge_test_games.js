// Deletes every seeded test game and scrubs the references pointing at them.
//
// Written after a seeded game was found carrying a REAL user (Zamuel, a Miami
// ambassador) on 2026-08-14. Tim's account should be left with only his genuine
// history -- one played game from March 2024 -- and no test fixtures at all.
//
// Deleting a game document is not enough on its own: other documents hold
// DocumentReferences to it, and a dangling ref is what turns a cleanup into a
// crash somewhere else. This also clears, for every user:
//   games · played_games · upcoming_games · pending_feedback · pending_votes
// and deletes the game's own messages and live_events.
//
//   node purge_test_games.js           # dry run, prints everything it WOULD do
//   node purge_test_games.js --write   # actually delete
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
const { FieldValue } = admin.firestore;

const WRITE = process.argv.includes("--write");

// Arrays on a user doc that can hold a DocumentReference to a game.
const USER_GAME_ARRAYS = [
  "games",
  "played_games",
  "upcoming_games",
  "pending_feedback",
  "pending_votes",
];

(async () => {
  const snap = await db.collection("games").where("is_test_game", "==", true).get();
  console.log(`${snap.size} games with is_test_game: true\n`);
  if (snap.empty) process.exit(0);

  const gameIds = new Set(snap.docs.map((d) => d.id));

  // SAFETY: never touch a game that is not flagged as a test game. The query
  // already guarantees it, but this is the one irreversible step in the script.
  for (const d of snap.docs) {
    if (d.data().is_test_game !== true) {
      console.error(`REFUSING: ${d.id} is not is_test_game`);
      process.exit(1);
    }
  }

  // Who references these games?
  const touchedUsers = new Set();
  for (const d of snap.docs) {
    for (const a of d.data().attendees || []) touchedUsers.add(a.id);
    for (const s of d.data().teams || []) if (s.user_id) touchedUsers.add(s.user_id);
    if (d.data().organizer) touchedUsers.add(d.data().organizer);
  }

  console.log("games to delete:");
  for (const d of snap.docs) {
    const g = d.data();
    const when = g.date?.toDate?.().toISOString().slice(0, 16) || "?";
    console.log(`  ${d.id}  ${when}  ${g.status?.padEnd(9)}  ${g.reservation_name || g.centre || ""}`);
  }

  console.log(`\nusers whose arrays will be scrubbed: ${touchedUsers.size}`);

  let subMessages = 0;
  let subEvents = 0;
  for (const d of snap.docs) {
    const [msgs, evs] = await Promise.all([
      db.collection("messages").where("game_id", "==", d.ref).get(),
      d.ref.collection("live_events").get(),
    ]);
    subMessages += msgs.size;
    subEvents += evs.size;
  }
  console.log(`messages to delete:    ${subMessages}`);
  console.log(`live_events to delete: ${subEvents}`);

  if (!WRITE) {
    console.log("\ndry run. re-run with --write to delete.");
    process.exit(0);
  }

  // 1. Scrub user back-references FIRST. If the run dies midway, a user
  //    pointing at a game that still exists is harmless; a user pointing at a
  //    deleted game is not.
  let scrubbed = 0;
  for (const uid of touchedUsers) {
    const ref = db.collection("users").doc(uid);
    const u = await ref.get();
    if (!u.exists) continue;
    const data = u.data();
    const update = {};
    for (const field of USER_GAME_ARRAYS) {
      const arr = data[field];
      if (!Array.isArray(arr) || arr.length === 0) continue;
      const keep = arr.filter((r) => !(r && r.id && gameIds.has(r.id)));
      if (keep.length !== arr.length) update[field] = keep;
    }
    if (Object.keys(update).length) {
      await ref.update(update);
      scrubbed++;
      console.log(`  scrubbed ${uid}: ${Object.keys(update).join(", ")}`);
    }
  }
  console.log(`scrubbed ${scrubbed} user docs`);

  // 2. Delete messages, live_events, outsiders, then the game itself.
  let n = 0;
  for (const d of snap.docs) {
    const msgs = await db.collection("messages").where("game_id", "==", d.ref).get();
    for (const m of msgs.docs) await m.ref.delete();

    for (const sub of ["live_events", "outsiders"]) {
      const s = await d.ref.collection(sub).get();
      for (const e of s.docs) await e.ref.delete();
    }

    await d.ref.delete();
    n++;
  }
  console.log(`\ndeleted ${n} games.`);
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
