// A FULL 10/10 test game at VSD39 Dole, for working on the Live teams step.
//
// The earlier test games hold only Tim and nine open spots, which is useless
// for a screen whose whole job is rearranging real players. This one is full,
// with a realistic mix: several test accounts, a gold account, and two hosts
// who brought guests.
//
// SAFETY, same as create_live_test_games.js:
//   visibility  private   -- cannot surface in anyone's feed or alerts
//   is_test_game true     -- findable and deletable
//   payment_type on-site  -- never touches Stripe
//   attendees are test accounts only, plus Tim
//
//   node create_live_teams_test_game.js          # dry run
//   node create_live_teams_test_game.js --write  # create it
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
const { Timestamp, GeoPoint } = admin.firestore;

const WRITE = process.argv.includes("--write");

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2";  // gold_status -> shows the badge
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";
const LIAM = "Go2YXYj9FFW6xG28HZNBcrDkIJV2";
const SOPHIE = "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2";
const TODD = "xz7cm07tVlZkt71QsLdmeTSCPYI3";

// 10 spots, full. Guests sit with their host, which is what placement now
// guarantees -- the teams step should never have to fix that, only fairness.
//
// team_a  Tim (+2 guests), Gina, Marco
// team_b  Lucia (+1 guest), Noah, Liam, Sophie
const SPOTS = [
  { team_side: "team_a", user_id: TIM, plus_one: false, position: "midfielder" },
  { team_side: "team_a", user_id: TIM, plus_one: true },
  { team_side: "team_a", user_id: TIM, plus_one: true },
  { team_side: "team_a", user_id: GINA, plus_one: false, position: "forward" },
  { team_side: "team_a", user_id: MARCO, plus_one: false, position: "goalkeeper" },

  { team_side: "team_b", user_id: LUCIA, plus_one: false, position: "defender" },
  { team_side: "team_b", user_id: LUCIA, plus_one: true },
  { team_side: "team_b", user_id: NOAH, plus_one: false, position: "midfielder" },
  { team_side: "team_b", user_id: LIAM, plus_one: false, position: "forward" },
  { team_side: "team_b", user_id: SOPHIE, plus_one: false, position: "goalkeeper" },
];

const teams = SPOTS.map((s, i) => ({
  spot_number: i + 1,
  status: "confirmed",
  ...s,
}));

// Kick-off shortly from now, so the game is inside Live's T-30 window and the
// match clock has something to count.
const kickoff = new Date(Date.now() + 10 * 60 * 1000);

const gameDoc = {
  address: "VSD39 Dole",
  centre: "VSD39 Dole",
  reservation_name: "Test équipes Live (plein)",
  place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
  location: new GeoPoint(47.10255979999999, 5.5016487),
  date: Timestamp.fromDate(kickoff),
  end_time: Timestamp.fromDate(new Date(kickoff.getTime() + 60 * 60000)),
  duration: 60,
  max_players: 10,
  mood: "chill",
  organizer: TIM,
  type: "captain",
  price: 0,
  currency: "EUR",
  visibility: "private",
  players_to_find: 0,
  sport: "soccer",
  payment_type: "on-site",
  time_zone: "Europe/Paris",
  country_code: "FR",
  level_deltas: ["five_six"],
  gold_exclusive: false,
  status: "published",
  poteau_live: true,
  is_test_game: true,
  created_on: Timestamp.now(),
  teams,
  attendees: teams.map((s) => db.collection("users").doc(s.user_id)),
  interested: [],
  messages: [],
  outsiders: [],
};

(async () => {
  const names = {};
  for (const id of [...new Set(SPOTS.map((s) => s.user_id))]) {
    const u = await db.collection("users").doc(id).get();
    names[id] = u.exists ? u.get("display_name") : "?";
  }
  console.log("VSD39 Dole — 'Test équipes Live (plein)'");
  console.log("kickoff: " + kickoff.toISOString() + "  (in 10 min)");
  console.log("private | is_test_game | on-site | poteau_live");
  console.log("");
  for (const side of ["team_a", "team_b"]) {
    console.log(
      "  " +
        side +
        ": " +
        teams
          .filter((s) => s.team_side === side)
          .map((s) => (s.plus_one ? "+1 " : "") + names[s.user_id])
          .join(" | ")
    );
  }
  console.log("");

  if (!WRITE) {
    console.log("dry run. re-run with --write to create it.");
    process.exit(0);
  }

  const ref = await db.collection("games").add(gameDoc);
  console.log("created games/" + ref.id);
  console.log("(no invitations or connect docs: private + is_test_game)");
  process.exit(0);
})().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
