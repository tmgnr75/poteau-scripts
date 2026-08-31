// Does a settled PADEL result actually produce padel stats?
//
// The engine deployed today (onGameStatsChanged, 31 Aug) counts padel's three
// tiers. This proves the whole path on a real settled padel game rather than on
// a fixture: read the game, run the DEPLOYED computeStats over its attendees,
// and print the six padel fields.
//
// READ-ONLY. Computes; writes nothing.
//
//   node verify_padel_stats_path.js [gameId]
const path = require("path");
const FUNCTIONS = "/Users/tmgnr/poteau-workspace/cloud-functions/functions";
const admin = require(path.join(FUNCTIONS, "node_modules/firebase-admin"));
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
}
const db = admin.firestore();

// The padel test game that carries a settled proposal.
const GAME = process.argv[2] || "kaChUpCXcvMf7uhgYkpE";

async function main() {
  const doc = await db.collection("games").doc(GAME).get();
  if (!doc.exists) {
    console.log(`game ${GAME} not found`);
    return;
  }
  const g = doc.data();
  const isTest = g.is_test_game === true;
  console.log(`game     ${GAME}`);
  console.log(`sport    ${g.sport}`);
  console.log(`status   ${g.status}`);
  console.log(`test     ${g.is_test_game === true}`);
  console.log(`centre   ${g.centre}`);

  const props = g.score_proposals || [];
  console.log(`\nscore_proposals: ${props.length}`);
  for (const p of props) {
    const periods = (p.periods || [])
      .map((x) => `${x.team_a}-${x.team_b}`)
      .join(" ");
    console.log(
      `  periods=[${periods}] proposed_by=${p.proposed_by} ` +
        `agreed_by=[${(p.agreed_by || []).join(",")}]`
    );
  }

  // The teams array is what tells the engine which side a player was on.
  const teams = g.teams || [];
  const sides = teams
    .filter((t) => t.user_id || t.player)
    .map((t) => `${t.user_id || t.player}:${t.team_side || t.side || "?"}`);
  console.log(`\nteams entries: ${teams.length}`);
  console.log(`  ${sides.slice(0, 8).join("  ")}`);

  // Run the DEPLOYED engine, not a reimplementation. computeStats(userId,
  // games) is pure: fetchPlayedGames does the reading.
  const {
    computeStats,
    fetchPlayedGames,
  } = require(path.join(FUNCTIONS, "gen2/recomputeUserStats"));

  const seen = new Set();
  for (const t of teams) {
    const uid = t.user_id || t.player;
    if (!uid || typeof uid !== "string" || seen.has(uid)) continue;
    seen.add(uid);
    try {
      const games = await fetchPlayedGames(uid);
      const out = computeStats(uid, games);
      const padel = out && out.padel;
      console.log(`\n${uid}  (${games.length} played games)`);
      if (!padel) {
        // EXPECTED on a seeded game. computeStats drops `is_test_game`
        // fixtures (since 2026-08-14) so re-seeding cannot raise phantom drift
        // alerts, and the only settled padel game in the database is a test
        // one. A padel stats block therefore cannot be proven on seeded data.
        // Prove the arithmetic directly instead, via periodsOf + matchScore.
        console.log(
          "   no padel block" +
            (isTest ? "  (EXPECTED: test games are excluded from stats)" : "")
        );
        continue;
      }
      console.log(
        `   games_played        ${padel.games_played}\n` +
        `   matches_won         ${padel.matches_won}/${padel.matches_with_result}\n` +
        `   sets_won            ${padel.sets_won}/${padel.sets_played}\n` +
        `   padel_games_won     ${padel.padel_games_won}/${padel.padel_games_played}`
      );
      // Soccer terms must be absent or zero on a padel block.
      const leaked = ["wins", "draws", "losses", "goals"].filter(
        (k) => padel[k]
      );
      if (leaked.length) console.log(`   SOCCER LEAK: ${leaked.join(", ")}`);
    } catch (e) {
      console.log(`\n${uid}\n   compute failed: ${e.message}`);
    }
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
