// Create Poteau Live test games at VSD39 Dole.
//
// DELIBERATE DIFFERENCES from the real game this is modelled on:
//   payment_type on-site  -- an in-app game can touch Stripe. Never on a test.
//   visibility  private   -- must not surface in anyone's feed or alerts.
//   poteau_live true      -- the pilot cohort flag.
//   is_test_game true     -- so these are findable and deletable later.
//
// Attendees: ONLY Tim. Nobody else is invited, and no connect/alert docs are
// written, so this cannot notify anyone.
const path = require("path");
const admin = require(path.join("/Users/tmgnr/poteau-workspace/cloud-functions/functions", "node_modules/firebase-admin"));
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
const db = admin.firestore();
const { Timestamp, GeoPoint } = admin.firestore;

const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const WRITE = process.argv.includes("--write");

function teams(uid) {
  // 10 spots, Tim confirmed in team_a spot 1, the rest open. Mirrors the
  // structure of the real game exactly.
  const out = [];
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? "team_a" : "team_b";
    if (i === 0) {
      out.push({ spot_number: i + 1, team_side: side, status: "confirmed", user_id: uid, plus_one: false });
    } else {
      out.push({ spot_number: i + 1, team_side: side, status: "open" });
    }
  }
  return out;
}

function gameDoc(dateUtc, label) {
  return {
    address: "VSD39 Dole",
    centre: "VSD39 Dole",
    reservation_name: label,
    place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs",
    location: new GeoPoint(47.10255979999999, 5.5016487),
    date: Timestamp.fromDate(dateUtc),
    end_time: Timestamp.fromDate(new Date(dateUtc.getTime() + 60 * 60000)),
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
    created_on: Timestamp.now(),
    status: "published",
    teams: teams(TIM),
    attendees: [db.collection("users").doc(TIM)],
    poteau_live: true,
    is_test_game: true,
  };
}

(async () => {
  const now = new Date();

  // 1) The realistic one: next Friday 06:00 Paris (04:00 UTC in CEST).
  const friday = new Date(now);
  friday.setUTCHours(4, 0, 0, 0);
  while (friday.getUTCDay() !== 5 || friday <= now) friday.setUTCDate(friday.getUTCDate() + 1);

  // 2) One starting in 5 minutes, so the Live window is OPEN right now and the
  //    scoreboard actually renders on the simulator.
  const soon = new Date(now.getTime() + 5 * 60000);

  const plan = [
    { when: friday, label: "Test Poteau Live (vendredi)" },
    { when: soon, label: "Test Poteau Live (maintenant)" },
  ];

  for (const p of plan) {
    const doc = gameDoc(p.when, p.label);
    console.log(`\n${p.label}`);
    console.log(`  date UTC:   ${p.when.toISOString()}`);
    console.log(`  Paris:      ${p.when.toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}`);
    console.log(`  status:     ${doc.status} | visibility: ${doc.visibility} | payment: ${doc.payment_type}`);
    console.log(`  poteau_live: ${doc.poteau_live} | attendees: 1 (Tim only)`);
    if (WRITE) {
      const ref = await db.collection("games").add(doc);
      console.log(`  CREATED -> games/${ref.id}`);
    } else {
      console.log("  DRY RUN — nothing written");
    }
  }
  if (!WRITE) console.log("\nRe-run with --write to create.");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
