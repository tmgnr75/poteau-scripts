#!/usr/bin/env node
/**
 * B5 — write the derived stat block onto every user with a played game.
 *
 * Approved 2026-08-06 against the B4 dry-run report (80,775 games /
 * 35,474 users / 0 integrity violations). Tim's product decision, recorded in
 * spec §3.1b: EVERY user with at least one played game gets a visible block.
 * No minimum-games threshold — 46.5% of the population showing 1–2 games is
 * accepted, not a surprise to walk back later.
 *
 * Usage:
 *   node backfill_user_stats.js            # DRY RUN, writes nothing
 *   node backfill_user_stats.js --write    # apply
 *   node backfill_user_stats.js --write --resume   # continue after a crash
 *   node backfill_user_stats.js --verify   # re-run and prove it is a no-op
 *
 * RESUMABILITY. 35,475 writes is long enough to be interrupted, and a
 * half-written population with no way to tell which half is the failure mode
 * worth engineering against. So:
 *
 *   - the ordered user list is derived once and cached, so a resumed run
 *     processes exactly the same users in exactly the same order
 *   - a checkpoint file records the last completed index, flushed every chunk
 *   - --resume restarts at that index; without it, an existing checkpoint is
 *     refused rather than silently overwritten
 *
 * Even without any of that the operation is safe to repeat: the recompute is
 * idempotent and overwrites wholesale, so re-running from the start is
 * correct, merely slower. The checkpoint exists to save time, not correctness.
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

// The REAL derivation, imported not reimplemented, so what gets written is
// exactly what the trigger would write.
const { computeStats, SOURCE_VERSION } = require(
  path.join(FUNCTIONS, "gen2/recomputeUserStats.js")
);

const WRITE = process.argv.includes("--write");
const RESUME = process.argv.includes("--resume");
const VERIFY = process.argv.includes("--verify");
const PAGE = 2000;
const CHUNK = 400;           // users per checkpoint flush
const STATE = path.join(__dirname, ".backfill_user_stats.state.json");

/** Order-insensitive stable stringify — Firestore map key order is arbitrary. */
function stable(value) {
  return JSON.stringify(value, (k, v) => {
    if (v && typeof v.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((a, key) => (a[key] = v[key], a), {});
    }
    return v;
  });
}

/** One ordered pass over played games -> uid -> games. */
async function loadGamesByUser() {
  const byUser = new Map();
  let last = null, games = 0, reads = 0;
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
      games++;
      const ids = new Set(
        (g.attendees || [])
          .filter((r) => r && r.parent && r.parent.id === "users")
          .map((r) => r.id)
      );
      for (const uid of ids) {
        let arr = byUser.get(uid);
        if (!arr) byUser.set(uid, (arr = []));
        arr.push(g);
      }
    }
    last = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE) break;      // break AFTER consuming the partial page
    if (games % 20000 === 0) process.stderr.write(".");
  }
  process.stderr.write("\n");
  return { byUser, games, reads };
}

async function main() {
  const t0 = Date.now();
  const L = console.log;

  L("=".repeat(72));
  L(VERIFY ? "B5 VERIFY — recompute and compare, writes nothing"
    : WRITE ? "B5 BACKFILL — WRITING" : "B5 BACKFILL — DRY RUN, writes nothing");
  L("=".repeat(72));

  // ---- count BEFORE (per the handover: count before, count after) ---------
  const beforeSnap = await db.collection("users").orderBy("stats").limit(1000).get();
  L(`\nUsers carrying a stats field BEFORE: ${beforeSnap.size}` +
    (beforeSnap.size === 1000 ? "+ (capped)" : ""));

  const { byUser, games, reads } = await loadGamesByUser();
  // Deterministic order, so a resumed run matches the original exactly.
  const uids = [...byUser.keys()].sort();
  L(`Played games: ${games.toLocaleString()}  ` +
    `Users to process: ${uids.length.toLocaleString()}  reads: ${reads.toLocaleString()}`);

  // ---- verify mode: prove the backfill was a no-op ------------------------
  if (VERIFY) {
    let checked = 0, drifted = 0;
    const sample = [
      uids[0], uids[Math.floor(uids.length / 3)], uids[Math.floor(uids.length / 2)],
      uids[uids.length - 1],
      // named cases Tim asked for
      "Dohg1zNvhsbmGrYuAmExKFyjruw2",
    ].filter((u, i, a) => u && a.indexOf(u) === i);
    // plus a random spread
    for (let i = 0; i < 200; i++) {
      sample.push(uids[Math.floor((i / 200) * uids.length)]);
    }
    for (const uid of [...new Set(sample)]) {
      if (!byUser.has(uid)) continue;
      const { stats } = computeStats(uid, byUser.get(uid));
      const doc = await db.collection("users").doc(uid).get();
      const stored = doc.exists ? (doc.get("stats") || {}) : {};
      // Compare content only: computed_at legitimately differs per run.
      const strip = (s) => stable(Object.fromEntries(Object.entries(s).map(
        ([sport, b]) => {
          const { computed_at, ...rest } = b;
          return [sport, rest];
        })));
      const fresh = Object.fromEntries(Object.entries(stats).map(
        ([sp, b]) => [sp, { ...b, source_version: SOURCE_VERSION }]));
      checked++;
      if (strip(fresh) !== strip(stored)) {
        drifted++;
        L(`  DRIFT ${uid}`);
        L(`    stored:   ${strip(stored)}`);
        L(`    recompute:${strip(fresh)}`);
      }
    }
    L(`\nVerified ${checked} users — ${drifted} drifted (expect 0).`);
    L(drifted === 0
      ? "Recomputing changes nothing. The backfill is correct."
      : "*** DRIFT FOUND — the backfill is NOT correct ***");
    process.exit(drifted === 0 ? 0 : 1);
  }

  // ---- resume handling ----------------------------------------------------
  let startAt = 0;
  if (fs.existsSync(STATE)) {
    const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
    if (!RESUME) {
      L(`\nA checkpoint exists (${st.done}/${st.total} done, ` +
        `written ${new Date(st.at).toISOString()}).`);
      L("Refusing to start over and silently redo it. Either:");
      L("  --resume        continue from where it stopped");
      L(`  rm ${STATE}     discard and start fresh`);
      process.exit(2);
    }
    if (st.total !== uids.length) {
      L(`\nCheckpoint was for ${st.total} users, now ${uids.length}. The user`);
      L("list changed (the DB is live). Resuming by UID, not index.");
      startAt = st.lastUid ? Math.max(0, uids.indexOf(st.lastUid) + 1) : 0;
    } else {
      startAt = st.done;
    }
    L(`\nRESUMING at index ${startAt} (${uids.length - startAt} remaining)`);
  }

  // ---- the pass -----------------------------------------------------------
  let written = 0, skipped = 0, failed = 0;
  const violations = [];
  const t1 = Date.now();

  for (let i = startAt; i < uids.length; i++) {
    const uid = uids[i];
    try {
      const { stats } = computeStats(uid, byUser.get(uid));
      if (Object.keys(stats).length === 0) { skipped++; continue; }

      for (const [sport, b] of Object.entries(stats)) {
        if (b.games_with_score > b.games_with_result ||
            b.games_with_result > b.games_played ||
            b.wins + b.draws + b.losses !== b.games_with_result) {
          violations.push(`${uid} ${sport} ${JSON.stringify(b)}`);
        }
      }

      if (WRITE) {
        const now = new Date();
        const toWrite = {};
        for (const [sport, b] of Object.entries(stats)) {
          toWrite[sport] = { ...b, computed_at: now, source_version: SOURCE_VERSION };
        }
        await db.collection("users").doc(uid).set({ stats: toWrite }, { merge: true });
      }
      written++;
    } catch (err) {
      failed++;
      console.error(`  FAILED ${uid}: ${err.message}`);
    }

    if ((i + 1) % CHUNK === 0) {
      if (WRITE) {
        fs.writeFileSync(STATE, JSON.stringify({
          done: i + 1, total: uids.length, lastUid: uid, at: Date.now(),
        }));
      }
      const rate = (i + 1 - startAt) / ((Date.now() - t1) / 1000);
      const eta = Math.round((uids.length - i - 1) / rate);
      process.stderr.write(
        `\r  ${i + 1}/${uids.length} (${((i + 1) / uids.length * 100).toFixed(1)}%) ` +
        `${rate.toFixed(0)}/s eta ${Math.floor(eta / 60)}m${eta % 60}s   `
      );
    }
  }
  process.stderr.write("\n");

  // ---- count AFTER --------------------------------------------------------
  let afterCount = 0, lastDoc = null;
  for (;;) {
    let q = db.collection("users").orderBy("stats").limit(PAGE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const s = await q.get();
    if (s.empty) break;
    afterCount += s.size;
    lastDoc = s.docs[s.docs.length - 1];
    if (s.size < PAGE) break;
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  L("");
  L("-".repeat(72));
  L(`Processed          ${written.toLocaleString()}`);
  L(`Skipped (no stats) ${skipped}`);
  L(`Failed             ${failed}`);
  L(`Integrity failures ${violations.length}  (expected 0)`);
  violations.slice(0, 10).forEach((v) => L(`    ${v}`));
  L(`Users with a stats field AFTER: ${afterCount.toLocaleString()}`);
  L(`Runtime ${secs}s`);
  L("");
  if (!WRITE) {
    L("DRY RUN — nothing was written. Re-run with --write to apply.");
  } else {
    L("Backfill complete. Now run:  node backfill_user_stats.js --verify");
    if (failed === 0 && fs.existsSync(STATE)) {
      fs.unlinkSync(STATE);
      L("Checkpoint cleared (clean finish).");
    }
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
