#!/usr/bin/env node
/**
 * Fixtures for the two kickoff-guard checks (A1 and A2 on the 230 test list).
 *
 * A1 — a game you get notifications about, already started: the Home card must
 *      drop its Join button and offer only "Couper les notifs". Join opens the
 *      payment sheet, so this is a money path, not a layout detail.
 * A2 — the same game as an INVITATION row, which used to stay joinable for 30
 *      minutes past kickoff.
 *
 * Plus the boundaries either side, because a guard is only proven by the cases
 * that must still work:
 *   - a game 20 minutes from kickoff  -> Join, normally
 *   - a game 2 minutes past kickoff   -> no Join (the exact reported case)
 *   - a game 40 minutes past kickoff  -> no Join, still visible (in progress)
 *   - a game that FINISHED            -> no card at all
 *
 * IDENTIFIED BY KICKOFF MINUTE, the convention `seed_test_matrix.js` uses:
 * every game here starts at :07, :17, :27, :37 so it is unmistakable on Home.
 *
 * ALWAYS private, ALWAYS at VSD39 Dole. A public seed at a real venue reached
 * real users within 35 minutes on 2026-08-17; a game in Kinshasa would still be
 * public.
 *
 *   node seed_kickoff_guards.js            # dry run
 *   node seed_kickoff_guards.js --write
 *   node seed_kickoff_guards.js --clean    # remove them again
 */
const admin = require("firebase-admin");
admin.initializeApp({
  credential: admin.credential.cert(
    require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
});

const WRITE = process.argv.includes("--write");
const CLEAN = process.argv.includes("--clean");
const db = admin.firestore();
const TAG = "kickoff_guards";
const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";

/// The seed roster: `is_test_account` users, the same ones
/// `seed_test_matrix.js` uses. No real player ever stands on a fake pitch.
///
/// TIM IS NOT ONE OF THEM, and that is the whole point of these fixtures. The
/// first version put his uid in `teams` AND in `interested`, so he was already
/// on the roster -- and a player who is already in a game is never offered
/// Join, whatever the kickoff guard does (Tim, 2026-09-22: "it's not games I'm
/// interested or invited, it's games I'm already on -- so I can't join"). The
/// fixture could not test the thing it was built for.
const OTHERS = [
  "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2",
  "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1",
  "8vZmdIBOZTcqMFMQKltTcfc7ffl1",
  "9si5imsCVUUQ48LF5sc9XFLFtEj1",
  "Go2YXYj9FFW6xG28HZNBcrDkIJV2",
  "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2",
];

const VENUE = {
  centre: "VSD39 Dole",
  place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
  address: "VSD39, Dole, France",
  location: new admin.firestore.GeoPoint(47.0930, 5.4900),
};

/** Minutes from now, with the SECONDS zeroed but the offset preserved.
 *
 * An earlier version forced the minute onto a chosen mark with `setMinutes`,
 * which silently moved the kickoff by up to an hour -- "40 minutes in" landed
 * after "2 minutes in". The offset is what is under test, so it is exact, and
 * the identifying digit goes in the SECONDS-free minute only where it does not
 * fight the offset: the label in `reservation_name` is the reliable marker.
 */
function at(minutesFromNow) {
  const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
  d.setSeconds(0, 0);
  return d;
}

const FIXTURES = [
  { label: "A1 · 20min BEFORE kickoff — Join should work",
    when: at(20),  duration: 60, invited: false },
  { label: "A1 · 2min AFTER kickoff — NO Join, only Couper les notifs",
    when: at(-2), duration: 60, invited: false },
  { label: "A1 · 40min in, still playing — NO Join, card still there",
    when: at(-40), duration: 60, invited: false },
  { label: "A1 · FINISHED 30min ago — no card at all",
    when: at(-95), duration: 60, invited: false },
  { label: "A2 · INVITED, 5min after kickoff — Activer les notifs, grey",
    when: at(-5), duration: 60, invited: true },
];

/** A roster of OTHER people, with room left.
 *
 * Room left matters as much as who is on it: a full game hides Join for its own
 * reason, which would mask whether the kickoff guard did anything.
 */
function teams(max) {
  const out = [];
  for (let i = 0; i < max; i++) {
    out.push(i < OTHERS.length
      ? { user_id: OTHERS[i], status: "confirmed", plus_one: false,
          team_side: i % 2 ? "team_b" : "team_a" }
      : { user_id: "", status: "open", team_side: i % 2 ? "team_b" : "team_a" });
  }
  return out;
}

(async () => {
  if (CLEAN) {
    const snap = await db.collection("games").where("seed_tag", "==", TAG).get();
    console.log(`removing ${snap.size} seeded game(s)`);
    for (const d of snap.docs) {
      // Never delete a game somebody else joined.
      // Only a real player joining is a reason to keep it; the seeded test
      // accounts are expected to be there.
      const real = (d.data().attendees || [])
        .filter((r) => r.id !== TIM && !OTHERS.includes(r.id));
      if (real.length) { console.log("  KEEPING", d.id, "- a real player joined"); continue; }
      await d.ref.delete();
      console.log("  deleted", d.id);
    }
    const inv = await db.collection("game_invitations")
      .where("invitee", "==", db.collection("users").doc(TIM)).get();
    let n = 0;
    for (const d of inv.docs) {
      const g = d.data().game;
      if (!g) continue;
      const gs = await g.get();
      if (!gs.exists || gs.data().seed_tag === TAG) { await d.ref.delete(); n++; }
    }
    console.log(`removed ${n} invitation(s)`);
    // And take them out of Tim's interested list implicitly (game gone).
    process.exit(0);
  }

  console.log(`${WRITE ? "WRITING" : "DRY RUN"} — ${FIXTURES.length} fixtures`);
  console.log("private, VSD39 Dole, seed_tag=" + TAG + "\n");

  for (const f of FIXTURES) {
    const hhmm = f.when.toTimeString().slice(0, 5);
    console.log(`  ${hhmm}  ${f.label}`);
    if (!WRITE) continue;

    const ref = await db.collection("games").add({
      // A TEST ACCOUNT ORGANIZES, not Tim: an organizer sees their own game's
      // card in a different state entirely and is never offered Join.
      organizer: OTHERS[0],
      sport: "soccer",
      status: "published",
      // NEVER public.
      visibility: "private",
      date: admin.firestore.Timestamp.fromDate(f.when),
      duration: f.duration,
      max_players: 10,
      players_to_find: 4,
      teams: teams(10),
      attendees: OTHERS.map((u) => db.collection("users").doc(u)),
      // TIM IS INTERESTED ONLY -- never on the roster. That is what puts the
      // card on his Home in the notifications state with a joinable spot,
      // which is the case under test.
      interested: [db.collection("users").doc(TIM)],
      centre: VENUE.centre,
      place_id: VENUE.place_id,
      address: VENUE.address,
      location: VENUE.location,
      price: 11.0,
      price_undiscounted: 11.0,
      payment_type: "in-app",
      currency: "EUR",
      mood: "chill",
      level: 3,
      level_deltas: [],
      gold_exclusive: false,
      time_zone: "Europe/Paris",
      created_on: admin.firestore.FieldValue.serverTimestamp(),
      seed_tag: TAG,
      is_test_game: true,
      reservation_name: f.label,
    });

    if (f.invited) {
      await db.collection("game_invitations").add({
        inviter: db.collection("users").doc(OTHERS[0]),
        invitee: db.collection("users").doc(TIM),
        game: ref,
        status: "pending",
        created: admin.firestore.FieldValue.serverTimestamp(),
        game_date: admin.firestore.Timestamp.fromDate(f.when),
      });
    }
    console.log("      -> " + ref.id);
  }

  if (!WRITE) { console.log("\nDry run. Nothing written."); process.exit(0); }

  // Verify what landed, the way seed_test_matrix does.
  const check = await db.collection("games").where("seed_tag", "==", TAG).get();
  const bad = check.docs.filter((d) => {
    const g = d.data();
    return g.visibility !== "private" || g.centre !== VENUE.centre;
  });
  console.log(`\nverified ${check.size} game(s): ${bad.length ? "PROBLEM" : "all private, all at VSD39 Dole"}`);
  process.exit(0);
})();
