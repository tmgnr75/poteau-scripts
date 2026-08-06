#!/usr/bin/env node
/**
 * D3 — strip `played_games` and `upcoming_games` from user documents.
 *
 * DESTRUCTIVE. Deletes two fields from every user document that carries them.
 *
 * ORDER IS NOT NEGOTIABLE: D1 must be deployed and VERIFIED first.
 * `gameStatusUpdater` appended to `played_games` every time a game reached
 * `played`. Strip the field while that writer is live and the next game
 * recreates it — half-populated, containing only games played after the strip,
 * which is worse than either leaving it or removing it cleanly.
 *
 * Both fields are obsolete:
 *
 *   played_games    drifted 9.6% low over three years (31,050 missing
 *                   participations across 6,570 users) because it was appended
 *                   in exactly one code path. Replaced by `users.stats`,
 *                   recomputed from the games collection.
 *   upcoming_games  a legacy V1-V4 array, no longer maintained by design. The
 *                   app queries games by `attendees array-contains` instead.
 *
 * Usage:
 *   node strip_played_games.js              # DRY RUN, writes nothing
 *   node strip_played_games.js --write      # apply
 *   node strip_played_games.js --write --resume
 *
 * Resumable for the same reason B5 was: ~105k documents is long enough to be
 * interrupted, and a half-stripped population with no record of which half is
 * the failure worth engineering against. Re-running from the start is also
 * safe — deleting an absent field is a no-op — so the checkpoint saves time,
 * not correctness.
 */
const fs = require("fs");
const path = require("path");

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

const WRITE = process.argv.includes("--write");
const RESUME = process.argv.includes("--resume");
const PAGE = 1000;
const CHUNK = 400;
const STATE = path.join(__dirname, ".strip_played_games.state.json");
const FIELDS = ["played_games", "upcoming_games"];

async function main() {
  const t0 = Date.now();
  const L = console.log;

  L("=".repeat(72));
  L(WRITE ? "D3 — STRIPPING played_games / upcoming_games"
    : "D3 — DRY RUN, writes nothing");
  L("=".repeat(72));

  // Refuse to run at all if the D1 writer might still be live. This is a
  // guard against the ordering trap, not a formality: the check is cheap and
  // the failure it prevents is silent.
  if (WRITE) {
    const fnSrc = fs.readFileSync(path.join(FUNCTIONS, "index.js"), "utf8");
    const stillWrites = /updateData\.played_games\s*=/.test(fnSrc);
    if (stillWrites) {
      L("\nREFUSING TO RUN: index.js still contains a played_games write.");
      L("D1 must be deployed first, or gameStatusUpdater will recreate the");
      L("field half-populated on the next game that reaches `played`.");
      process.exit(2);
    }
    L("\nD1 check: no played_games write found in index.js — safe to proceed.");
  }

  let startAt = null;
  if (fs.existsSync(STATE)) {
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    if (!RESUME) {
      L(`\nA checkpoint exists (${st.done} done, last=${st.lastId}).`);
      L("Pass --resume to continue, or delete the file to start fresh:");
      L(`  rm ${STATE}`);
      process.exit(2);
    }
    startAt = st.lastId;
    L(`\nRESUMING after ${st.lastId} (${st.done} already done)`);
  }

  let scanned = 0;
  let withPlayed = 0;
  let withUpcoming = 0;
  let withEither = 0;
  let stripped = 0;
  let failed = 0;
  let last = startAt;
  // Distribution, to sanity-check against the B4/B5 numbers.
  let sumPlayedLen = 0;
  let maxPlayedLen = 0;
  let maxPlayedId = null;

  process.stderr.write("Scanning users");
  for (;;) {
    let q = db.collection("users").orderBy("__name__").limit(PAGE);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = WRITE ? db.batch() : null;
    let batchCount = 0;

    for (const doc of snap.docs) {
      scanned++;
      const pg = doc.get("played_games");
      const ug = doc.get("upcoming_games");
      const hasPg = pg !== undefined;
      const hasUg = ug !== undefined;
      if (hasPg) {
        withPlayed++;
        const len = Array.isArray(pg) ? pg.length : 0;
        sumPlayedLen += len;
        if (len > maxPlayedLen) { maxPlayedLen = len; maxPlayedId = doc.id; }
      }
      if (hasUg) withUpcoming++;
      if (!hasPg && !hasUg) continue;
      withEither++;

      if (WRITE) {
        const update = {};
        for (const f of FIELDS) {
          if (doc.get(f) !== undefined) {
            update[f] = admin.firestore.FieldValue.delete();
          }
        }
        batch.update(doc.ref, update);
        batchCount++;
      }
    }

    if (WRITE && batchCount > 0) {
      try {
        await batch.commit();
        stripped += batchCount;
      } catch (err) {
        failed += batchCount;
        console.error(`\n  batch failed near ${last}: ${err.message}`);
      }
    }

    last = snap.docs[snap.docs.length - 1].id;

    if (WRITE && scanned % CHUNK < PAGE) {
      fs.writeFileSync(STATE, JSON.stringify({
        done: stripped, scanned, lastId: last, at: Date.now(),
      }));
    }
    if (scanned % 20000 === 0) process.stderr.write(".");
    if (snap.size < PAGE) break;   // break AFTER consuming the partial page
  }
  process.stderr.write("\n");

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  L("");
  L(`Users scanned                    ${scanned.toLocaleString()}`);
  L(`  carrying played_games          ${withPlayed.toLocaleString()}`);
  L(`  carrying upcoming_games        ${withUpcoming.toLocaleString()}`);
  L(`  carrying either (docs to write)${withEither.toLocaleString()}`);
  L("");
  L(`played_games entries in total    ${sumPlayedLen.toLocaleString()}`);
  L(`largest played_games array       ${maxPlayedLen.toLocaleString()} (${maxPlayedId})`);
  L("");
  if (WRITE) {
    L(`Documents stripped               ${stripped.toLocaleString()}`);
    L(`Failed                           ${failed}`);
  }
  L(`Runtime                          ${secs}s`);
  L("");

  if (!WRITE) {
    L("DRY RUN — nothing was written.");
    L("");
    L("For comparison, the replacement is already in place:");
    L("  users.stats holds 35,481+ blocks, recomputed from the games");
    L("  collection, maintained by onGameStatsChanged and statsReconcile.");
    L("");
    L("Re-run with --write to apply, once these numbers are approved.");
  } else {
    L("Strip complete.");
    if (failed === 0 && fs.existsSync(STATE)) {
      fs.unlinkSync(STATE);
      L("Checkpoint cleared (clean finish).");
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
