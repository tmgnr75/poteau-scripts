/**
 * Copies `time_zone` from each game onto its invitations.
 *
 * WHY. The app groups invitations by day and never loads the game, so an
 * invitation carrying only `game_date` -- an absolute instant -- is bucketed in
 * the READER's timezone. A Miami 21:00 game showed under TOMORROW at 03:00 for
 * a viewer in Paris (Tim, 2026-09-24).
 *
 * Every creation path now writes the field (index.js x2, and
 * shared/inviteCreation.js for both of its callers), so this exists only for
 * documents written before that shipped.
 *
 * IDEMPOTENT: an invitation already carrying the field is skipped, so a re-run
 * after a partial failure costs reads and nothing else.
 *
 * ONLY WHERE IT CHANGES SOMETHING. An invitation whose game has no `time_zone`
 * is left alone: writing null would be a write that says nothing, and a missing
 * field already falls back to the device zone on the reader's side.
 *
 * Usage:
 *   node backfill_invitation_timezone.js            # dry run, prints the plan
 *   node backfill_invitation_timezone.js --write    # apply
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "krank-club",
});

const db = admin.firestore();
const WRITE = process.argv.includes("--write");

// PAGED, NEVER `.get()` ON THE WHOLE COLLECTION. `game_invitations` is one of
// the largest collections in the database -- it grows by tens of thousands of
// documents a day -- and loading it in one snapshot exhausted Node's heap
// outright ("Ineffective mark-compacts near heap limit") before a single row
// was examined.
const PAGE = 2000;
const NOW = new Date();
const SKIP_ZONE = "Europe/Paris";

(async () => {
  const zoneByGame = new Map();  // one read per GAME, not per invitation
  const writer = WRITE ? db.bulkWriter() : null;
  // BulkWriter retries individual failures; without a handler one failed write
  // rejects close() and the rest are lost.
  if (writer) writer.onWriteError(err => err.failedAttempts < 3);

  const byZone = {};
  let scanned = 0, already = 0, noGame = 0, noZone = 0, queued = 0, skippedDefault = 0;
  let cursor = null;

  for (;;) {
    // FUTURE GAMES ONLY (Tim, 2026-09-24). A past invitation renders a day
    // nobody is going to open, and `game_invitations` is the largest
    // collection in the database -- scanning all of it is the biggest read
    // bill available and buys nothing visible.
    let q = db.collection("game_invitations")
      .where("game_date", ">", NOW)
      .orderBy("game_date")
      .limit(PAGE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    cursor = page.docs[page.docs.length - 1];
    scanned += page.size;

    for (const doc of page.docs) {
      const d = doc.data();
      if (d.time_zone) { already++; continue; }
      const gameRef = d.game;
      if (!gameRef) { noGame++; continue; }

      if (!zoneByGame.has(gameRef.id)) {
        const g = await gameRef.get();
        zoneByGame.set(gameRef.id, g.exists ? (g.data().time_zone || null) : null);
      }
      const tz = zoneByGame.get(gameRef.id);
      if (!tz) { noZone++; continue; }
      // ONLY WHERE IT CHANGES THE SCREEN. A dry run over 1,533,532 future
      // invitations found 1,512,572 in Europe/Paris against 763 everywhere
      // else -- 99.95%. A missing field already falls back to the DEVICE zone,
      // which is Europe/Paris for essentially all of those readers, so writing
      // it changes nothing they see. 1.5M writes to fix 763 visible cases is
      // the wrong trade; the skipped ones stay correct by fallback.
      if (tz === SKIP_ZONE) { skippedDefault++; continue; }

      byZone[tz] = (byZone[tz] || 0) + 1;
      queued++;
      if (writer) writer.set(doc.ref, { time_zone: tz }, { merge: true });
    }

    process.stdout.write(`\r  scanned ${scanned}, to write ${queued}...`);
    if (page.size < PAGE) break;
  }

  console.log(`\nscanned ${scanned} invitation(s)`);
  console.log(`  already had it : ${already}`);
  console.log(`  no game ref    : ${noGame}`);
  console.log(`  game has no tz : ${noZone}`);
  console.log(`  ${SKIP_ZONE} (device fallback is already right): ${skippedDefault}`);
  console.log(`  TO WRITE       : ${queued}`);
  console.log(`  games read     : ${zoneByGame.size}`);
  Object.entries(byZone).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .forEach(([z, n]) => console.log(`    ${String(n).padStart(6)}  ${z}`));

  if (!writer) {
    console.log("\ndry run. re-run with --write to apply.");
    process.exit(0);
  }
  await writer.close();
  console.log(`\nwrote ${queued} invitation(s)`);
  process.exit(0);
})();
