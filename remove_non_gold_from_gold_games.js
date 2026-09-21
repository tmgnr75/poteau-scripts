#!/usr/bin/env node
/**
 * Removes non-Gold players from games that have just become Gold-exclusive.
 *
 * Tim, 2026-09-21: "From D+2, remove non Gold players from games once the game
 * is back to being gold exclusive."
 *
 * THE D+2 RULE IS THE POINT. A game tonight or tomorrow keeps everyone who
 * joined it: telling somebody they are out of a game they planned their
 * evening around is worse than the subscription it recovers. From D+2 there is
 * time to find another game.
 *
 * WHAT IT TOUCHES, and what it deliberately does not:
 *   - the spot in `teams` goes back to "open", losing its user_id
 *   - one entry per freed spot is removed from `attendees`
 *   - the organizer is NEVER removed, whatever their Gold status. Removing
 *     somebody from a game they created would destroy it.
 *   - a `+1` guest goes with its host and is never stranded on its own.
 *
 * NO REFUNDS ARE NEEDED. Verified before writing this: all 336 affected games
 * are `payment_type: "on-site"` and none carries an authorized payment. If
 * that ever stops being true, this script must go through `removePlayer`
 * instead, which handles the Stripe side.
 *
 *   node remove_non_gold_from_gold_games.js            # dry run
 *   node remove_non_gold_from_gold_games.js --write
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(
    require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
});

const WRITE = process.argv.includes("--write");
const db = admin.firestore();

function cutoff() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 2);
  return d;
}

(async () => {
  const D2 = cutoff();
  console.log(`${WRITE ? "WRITING" : "DRY RUN"}`);
  console.log(`Only games kicking off on or after ${D2.toISOString()}.\n`);

  const snap = await db.collection("games").orderBy("date", "desc").limit(6000).get();
  const orgCache = {};
  let gamesTouched = 0, spotsFreed = 0, playersRemoved = 0;
  let guestsRemoved = 0, organizersKept = 0;
  const detail = [];

  for (const doc of snap.docs) {
    const g = doc.data();
    if (g.gold_exclusive !== true) continue;
    const kickoff = g.date ? g.date.toDate() : null;
    if (!kickoff || kickoff < D2) continue;

    const teams = Array.isArray(g.teams) ? g.teams : [];
    const held = [...new Set(teams
      .filter((s) => s && s.user_id && !s.plus_one &&
        (s.status === "confirmed" || s.status === "reserved"))
      .map((s) => s.user_id))];
    if (!held.length) continue;

    // Who is not Gold?
    const docs = await db.getAll(...held.map((u) => db.collection("users").doc(u)));
    const nonGold = new Set(docs
      .filter((d) => d.exists && d.data().gold_status !== true)
      .map((d) => d.id));
    if (!nonGold.size) continue;

    // THE ORGANIZER STAYS. Removing them would leave a game nobody owns.
    if (g.organizer && nonGold.has(g.organizer)) {
      nonGold.delete(g.organizer);
      organizersKept++;
    }
    if (!nonGold.size) continue;

    const newTeams = teams.map((s) => {
      if (!s || !s.user_id || !nonGold.has(s.user_id)) return s;
      // A guest goes with its host: its user_id IS the host's.
      if (s.plus_one) guestsRemoved++;
      return { ...s, user_id: "", status: "open", plus_one: false, position: null };
    });
    const freed = newTeams.filter((s, i) => s.status === "open" && teams[i].status !== "open").length;
    if (!freed) continue;

    // `attendees` holds one DocumentReference per spot, guests included, so
    // exactly as many entries come out as spots were freed.
    const attendees = Array.isArray(g.attendees) ? [...g.attendees] : [];
    for (const s of teams) {
      if (!s || !s.user_id || !nonGold.has(s.user_id)) continue;
      const i = attendees.findIndex((r) => r && r.id === s.user_id);
      if (i >= 0) attendees.splice(i, 1);
    }

    gamesTouched++;
    spotsFreed += freed;
    playersRemoved += nonGold.size;
    detail.push({ id: doc.id, centre: g.centre,
      kickoff: kickoff.toISOString().slice(0, 16), freed, players: nonGold.size });

    if (WRITE) {
      await doc.ref.update({ teams: newTeams, attendees });
    }
  }

  console.log(`games changed      : ${gamesTouched}`);
  console.log(`spots freed        : ${spotsFreed}`);
  console.log(`players removed    : ${playersRemoved}`);
  console.log(`  of which guests  : ${guestsRemoved}`);
  console.log(`organizers KEPT    : ${organizersKept}`);
  console.log("\nthe ten biggest:");
  detail.sort((a, b) => b.freed - a.freed).slice(0, 10)
    .forEach((d) => console.log(`  ${String(d.freed).padStart(2)} spots  ${d.kickoff}  ${d.centre}`));
  if (!WRITE) console.log("\nDry run. Nothing written.");
  process.exit(0);
})();
