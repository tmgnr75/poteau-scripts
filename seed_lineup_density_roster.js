// Fill a test game's roster so the line-up's density work can be SEEN.
//
// The two VSD39 Dole test games hold only Tim and nine open spots, which
// exercises the shrunken card but neither the guest strip nor the split host
// -- and the split host is 41.7% of real hosts, so it is the case most worth
// looking at.
//
// This writes ONLY `teams` on a game that is already private, is_test_game
// and organized by Tim. It does not touch attendees, status, visibility or
// any notification path, so it still cannot reach a real user.
//
//   node seed_lineup_density_roster.js            # dry run, prints the plan
//   node seed_lineup_density_roster.js --write    # apply
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

const GAME = process.env.GAME_ID || "VDbMga4BNc2Hv8IboZye";
const WRITE = process.argv.includes("--write");

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2"; // gold_status true -- shows the badge
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";

// Every case the card has to render, on one screen:
//
// team_a  Tim         host + 2 guests HERE, 2 more on team_b  -> split host
//         Gina        plain player, gold badge
//         (open)
// team_b  Tim         2 guests, no base spot on this side     -> orphan tile
//         Marco       host + 1 guest
//         Lucia       plain player
//         Noah        plain player
const SPOTS = [
  { team_side: "team_a", status: "confirmed", user_id: TIM, plus_one: false, position: "midfielder" },
  { team_side: "team_a", status: "confirmed", user_id: TIM, plus_one: true },
  { team_side: "team_a", status: "confirmed", user_id: TIM, plus_one: true },
  { team_side: "team_a", status: "confirmed", user_id: GINA, plus_one: false, position: "forward" },
  { team_side: "team_a", status: "open" },

  { team_side: "team_b", status: "confirmed", user_id: TIM, plus_one: true },
  { team_side: "team_b", status: "confirmed", user_id: TIM, plus_one: true },
  { team_side: "team_b", status: "confirmed", user_id: MARCO, plus_one: false, position: "goalkeeper" },
  { team_side: "team_b", status: "confirmed", user_id: MARCO, plus_one: true },
  { team_side: "team_b", status: "confirmed", user_id: LUCIA, plus_one: false, position: "defender" },
];

// spot_number is still written because other surfaces read it; the line-up no
// longer infers it from a tile's position.
const teams = SPOTS.map((s, i) => ({ spot_number: i + 1, ...s }));

function describe() {
  for (const side of ["team_a", "team_b"]) {
    const mine = teams.filter((s) => s.team_side === side);
    const hosts = new Set();
    const guestsBy = {};
    const tiles = [];
    for (const s of mine) {
      if (s.status === "open") { tiles.push("open"); continue; }
      if (s.plus_one) { guestsBy[s.user_id] = (guestsBy[s.user_id] || 0) + 1; continue; }
      if (!hosts.has(s.user_id)) { hosts.add(s.user_id); tiles.push(s.user_id.slice(0, 6)); }
    }
    for (const uid of Object.keys(guestsBy)) {
      if (!hosts.has(uid)) { hosts.add(uid); tiles.push(uid.slice(0, 6) + " (guests only)"); }
    }
    const strips = Object.entries(guestsBy).map(([u, n]) => u.slice(0, 6) + " +" + n);
    console.log("  " + side + ": " + mine.length + " spots -> " + tiles.length + " tiles");
    console.log("     tiles : " + tiles.join(", "));
    if (strips.length) console.log("     strips: " + strips.join(", "));
  }
}

(async () => {
  const ref = db.collection("games").doc(GAME);
  const doc = await ref.get();
  if (!doc.exists) throw new Error("no such game: " + GAME);

  // Refuse to touch anything that is not an isolated test game.
  if (doc.get("is_test_game") !== true) {
    throw new Error("REFUSING: " + GAME + " is not is_test_game");
  }
  if (doc.get("visibility") !== "private") {
    throw new Error("REFUSING: " + GAME + " is not private");
  }
  if (doc.get("organizer") !== TIM) {
    throw new Error("REFUSING: " + GAME + " is not organized by Tim");
  }

  console.log("game   : " + GAME + " (" + doc.get("reservation_name") + ")");
  console.log("status : " + doc.get("status") + " | private | is_test_game");
  console.log("");
  describe();
  console.log("");

  if (!WRITE) {
    console.log("dry run. re-run with --write to apply.");
    process.exit(0);
  }

  await ref.update({ teams });
  console.log("written: teams only. attendees/status/visibility untouched.");
  process.exit(0);
})().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
