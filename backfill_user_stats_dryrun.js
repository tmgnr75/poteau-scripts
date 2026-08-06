#!/usr/bin/env node
/**
 * B4 — backfill dry run. READ ONLY. Writes nothing to Firestore, ever.
 *
 * Produces the diff report that must be approved before B5 writes anything
 * (STATS_SCHEMA_SPEC.md §10).
 *
 * WHY ONE PASS OVER GAMES, NOT ONE QUERY PER USER:
 * The production path (recomputeUserStats) queries per user, which is right
 * for a trigger recomputing 22 people. For a full backfill that would be
 * ~35,000 queries returning ~322,000 documents. A single ordered pass over the
 * 80,774 played games touches each document once and yields every user's block
 * at the end. Same arithmetic, ~4x fewer reads, and it lets every game be
 * checked for integrity violations on the way through.
 *
 * The derivation below MUST stay identical to computeStats() in
 * gen2/recomputeUserStats.js. It is imported, not reimplemented, precisely so
 * the report cannot drift from what B5 will actually write.
 */
const path = require("path");

// gen2/admin.js initialises firebase-admin from the functions/ node_modules
// tree. Initialise THAT instance with credentials before requiring anything
// from gen2, or it falls back to default credentials and fails.
const FUNCTIONS = "/Users/tmgnr/poteau-workspace/cloud-functions/functions";
const admin = require(path.join(FUNCTIONS, "node_modules/firebase-admin"));
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    projectId: "krank-club",
  });
}
const db = admin.firestore();

const { computeStats } = require(
  path.join(FUNCTIONS, "gen2/recomputeUserStats.js")
);

const PAGE = 2000;

/**
 * Order-insensitive stable stringify.
 *
 * Firestore returns map keys in arbitrary order, so a plain JSON.stringify
 * compares key ORDER rather than content and reports false differences. That
 * has produced a spurious failure twice in this workstream; it lives here as a
 * shared helper so it cannot be forgotten again.
 */
function stable(value) {
  return JSON.stringify(value, (k, v) => {
    if (v && typeof v.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((acc, key) => {
        acc[key] = v[key];
        return acc;
      }, {});
    }
    return v;
  });
}

function pct(n, d) {
  return d === 0 ? "0.0%" : `${((n / d) * 100).toFixed(1)}%`;
}

async function main() {
  const t0 = Date.now();
  let reads = 0;

  // ---- Pass 1: stream every played game, bucket by user -------------------
  // Held in memory: uid -> array of that user's played games. Peak is roughly
  // the 322k participations, which is fine for a one-off report.
  const gamesByUser = new Map();
  let gameCount = 0;
  let last = null;

  process.stderr.write("Reading played games");
  for (;;) {
    let q = db.collection("games")
      .where("status", "==", "played")
      .orderBy("__name__")
      .limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    reads += snap.size;

    for (const doc of snap.docs) {
      const g = { id: doc.id, ...doc.data() };
      gameCount++;
      // Dedupe here is the +1 trap: the same user reference is repeated once
      // per guest, and 65.6% of all attendee entries are those duplicates.
      const ids = new Set(
        (g.attendees || [])
          .filter((r) => r && r.parent && r.parent.id === "users")
          .map((r) => r.id)
      );
      for (const uid of ids) {
        let arr = gamesByUser.get(uid);
        if (!arr) gamesByUser.set(uid, (arr = []));
        arr.push(g);
      }
    }

    last = snap.docs[snap.docs.length - 1].id;
    // Break AFTER consuming the partial page, never before.
    if (snap.size < PAGE) break;
    if (gameCount % 20000 === 0) process.stderr.write(".");
  }
  process.stderr.write("\n");

  // ---- Pass 2: run the REAL computeStats per user -------------------------
  const dist = new Map();          // games_played -> user count
  const violations = [];           // denominator / W-D-L failures
  const issues = [];               // cap violations, contradictions
  const movers = [];               // [uid, totalGames, perSport]
  let usersWithStats = 0;
  let sportKeyCounts = new Map();
  let totalParticipations = 0;

  for (const [uid, games] of gamesByUser) {
    const { stats, issues: userIssues } = computeStats(uid, games);
    const sports = Object.keys(stats);
    if (sports.length === 0) continue;   // should not happen; counted below
    usersWithStats++;

    let total = 0;
    for (const [sport, b] of Object.entries(stats)) {
      total += b.games_played;
      sportKeyCounts.set(sport, (sportKeyCounts.get(sport) || 0) + 1);

      // The three denominators must nest (spec §3.1).
      if (b.games_with_score > b.games_with_result ||
          b.games_with_result > b.games_played) {
        violations.push(
          `[DENOMINATOR] ${uid} ${sport}: score=${b.games_with_score} ` +
          `result=${b.games_with_result} played=${b.games_played}`
        );
      }
      // W/D/L must sum to its own denominator, not to games_played.
      if (b.wins + b.draws + b.losses !== b.games_with_result) {
        violations.push(
          `[WDL] ${uid} ${sport}: W${b.wins}+D${b.draws}+L${b.losses} ` +
          `!= games_with_result ${b.games_with_result}`
        );
      }
    }
    totalParticipations += total;
    dist.set(total, (dist.get(total) || 0) + 1);
    movers.push([uid, total, stats]);
    for (const i of userIssues) issues.push(`${uid}: ${i}`);
  }

  // ---- Pass 3: name the top movers ---------------------------------------
  movers.sort((a, b) => b[1] - a[1]);
  const top = movers.slice(0, 10);
  const names = new Map();
  for (const [uid] of top) {
    const d = await db.collection("users").doc(uid).get();
    reads++;
    names.set(uid, d.exists
      ? (d.get("display_name") || d.get("first_name") || "(no name)")
      : "(user document missing)");
  }

  // ---- Report -------------------------------------------------------------
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const L = console.log;
  L("=".repeat(76));
  L("B4 — BACKFILL DRY RUN.  NOTHING WAS WRITTEN.");
  L("=".repeat(76));
  L("");
  L(`Played games scanned          ${gameCount.toLocaleString()}`);
  L(`Users gaining a stats block   ${usersWithStats.toLocaleString()}`);
  L(`Total participations          ${totalParticipations.toLocaleString()}`);
  L(`Firestore document reads      ${reads.toLocaleString()}`);
  L(`Runtime                       ${secs}s`);
  L("");
  L("Per-sport blocks written:");
  for (const [sport, n] of [...sportKeyCounts].sort((a, b) => b[1] - a[1])) {
    L(`  ${sport.padEnd(10)} ${n.toLocaleString()} users`);
  }

  L("");
  L("-".repeat(76));
  L("DISTRIBUTION of games_played");
  L("-".repeat(76));
  const buckets = [[1,1],[2,2],[3,5],[6,10],[11,25],[26,50],[51,100],
                   [101,500],[501,Infinity]];
  for (const [lo, hi] of buckets) {
    let n = 0;
    for (const [g, c] of dist) if (g >= lo && g <= hi) n += c;
    const label = hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}-${hi}`;
    const bar = "#".repeat(Math.round((n / usersWithStats) * 60));
    L(`  ${label.padStart(8)} games  ${String(n).padStart(6)} users ` +
      `${pct(n, usersWithStats).padStart(6)}  ${bar}`);
  }

  L("");
  L("-".repeat(76));
  L("INTEGRITY");
  L("-".repeat(76));
  L(`Denominator / W-D-L violations   ${violations.length}   (expected 0)`);
  violations.slice(0, 20).forEach((v) => L(`    ${v}`));
  if (violations.length > 20) L(`    ... and ${violations.length - 20} more`);
  L(`Goal-cap / contradiction issues  ${issues.length}   (expected 0 today —`);
  L(`                                 no game carries proposals yet)`);
  issues.slice(0, 20).forEach((v) => L(`    ${v}`));
  if (issues.length > 20) L(`    ... and ${issues.length - 20} more`);

  L("");
  L("-".repeat(76));
  L("TOP 10 MOVERS by games_played — spot-check these");
  L("-".repeat(76));
  for (const [uid, total, stats] of top) {
    const per = Object.entries(stats)
      .map(([s, b]) => `${s}=${b.games_played}`).join(" ");
    L(`  ${String(total).padStart(5)}  ${uid}  ${per}`);
    L(`         ${names.get(uid)}`);
  }

  L("");
  L("-".repeat(76));
  L("SIZING B5");
  L("-".repeat(76));
  L(`  Users to write                ${usersWithStats.toLocaleString()}`);
  L(`  Reads for this report         ${reads.toLocaleString()}`);
  L(`  Writes B5 would perform       ${usersWithStats.toLocaleString()} ` +
    `(one set(merge) per user)`);
  L(`  Per-user-query alternative    ~${gamesByUser.size.toLocaleString()} queries ` +
    `/ ~${totalParticipations.toLocaleString()} document reads`);
  L("");
  L("  NOTE: these counts move. The database is live and games reach `played`");
  L("  continuously, so B5 will see slightly different totals. That is");
  L("  expected, not drift — the recompute is derived from whatever is true");
  L("  at the moment it runs, and is idempotent, so a game landing mid-run");
  L("  is picked up by the next pass rather than corrupting anything.");
  L("");
  L("NOTHING WAS WRITTEN. Approve this report before running B5.");

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
