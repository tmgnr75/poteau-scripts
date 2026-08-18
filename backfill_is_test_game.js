/**
 * Backfill `is_test_game: false` onto every game that does not carry the flag.
 *
 * WHY: `is_test_game` marks seeded fixtures so they can be excluded from real
 * surfaces. Only the seed scripts ever set it, so of 208,851 games exactly 44
 * are `true`, 3 are `false`, and 208,804 have NO VALUE AT ALL.
 *
 * That absence is not harmless, because Firestore equality does not match
 * documents missing the field. `where('is_test_game', isEqualTo: false)`
 * therefore reaches 0.0% of games, and the profile header built on it counted
 * 0 played games for every real user -- 0 instead of 1,876 for the heaviest
 * account. Caught before release (the query landed 2026-08-14 on an unpushed
 * branch), so no user ever saw it.
 *
 * WHY NOT JUST QUERY `!= true`. Firestore's `!=` also drops documents lacking
 * the field, so it is wrong in the same way. The only server-side query that
 * can express "not a test game" is equality against a value that is actually
 * present -- which is what this backfill creates. Reading every document and
 * filtering in Dart works but cannot be a count() aggregation, so it means
 * fetching thousands of documents to display one number.
 *
 * AFTER THIS RUNS, the flag must be set at every create path or the gap
 * reopens for new games. Verified writers today: the seed scripts (true) and
 * publishGame/draft promotion (see FOLLOW-UP below).
 *
 * SAFETY
 *   - only ever writes `false`, and only where the field is ABSENT. A game
 *     already marked `true` is never touched, so a seeded fixture cannot be
 *     converted into a real one by a careless re-run.
 *   - idempotent: a second run finds nothing to do.
 *   - batched at 400 with a cursor, so it is resumable and cannot exhaust
 *     memory on a 200k collection.
 *
 *   node scripts/backfill_is_test_game.js            # DRY RUN, writes nothing
 *   node scripts/backfill_is_test_game.js --write    # apply
 */
const path = require("path");
const FUNCTIONS = "/Users/tmgnr/poteau-workspace/cloud-functions/functions";
const admin = require(path.join(FUNCTIONS, "node_modules/firebase-admin"));
const sa = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
}
const db = admin.firestore();

const WRITE = process.argv.includes("--write");
const PAGE = 400;

async function main() {
  const t0 = Date.now();
  console.log(WRITE ? "APPLYING (--write)" : "DRY RUN — nothing will be written");

  const [total, isTrue, isFalse] = await Promise.all([
    db.collection("games").count().get(),
    db.collection("games").where("is_test_game", "==", true).count().get(),
    db.collection("games").where("is_test_game", "==", false).count().get(),
  ]);
  const t = total.data().count;
  const nTrue = isTrue.data().count;
  const nFalse = isFalse.data().count;
  console.log(
    `games=${t}  is_test_game true=${nTrue} false=${nFalse} absent=${t - nTrue - nFalse}`
  );

  // Walk the whole collection by document id. There is no "field is absent"
  // query in Firestore -- `where(field, '==', null)` matches an explicit null,
  // not a missing key -- so the only way to find these is to look at each doc.
  // Projected to __name__ only: the values are irrelevant, just presence.
  let cursor = null;
  let scanned = 0;
  let toFix = 0;
  let written = 0;

  for (;;) {
    let q = db.collection("games")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE)
      .select("is_test_game");
    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;

    let batch = db.batch();
    let inBatch = 0;
    for (const doc of snap.docs) {
      scanned++;
      // `undefined` means absent. An explicit `false` needs no write, and an
      // explicit `true` must never be overwritten.
      if (doc.get("is_test_game") !== undefined) continue;
      toFix++;
      if (WRITE) {
        batch.update(doc.ref, { is_test_game: false });
        inBatch++;
      }
    }
    if (WRITE && inBatch > 0) {
      await batch.commit();
      written += inBatch;
    }

    cursor = snap.docs[snap.docs.length - 1];
    if (scanned % 20000 < PAGE) {
      console.log(`  scanned=${scanned} needing=${toFix} written=${written}`);
    }
    if (snap.size < PAGE) break;
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\ndone in ${secs}s — scanned=${scanned} missing_flag=${toFix} written=${written}`
  );
  if (!WRITE && toFix > 0) {
    console.log("re-run with --write to apply.");
  }
  if (WRITE) {
    const after = await db.collection("games").where("is_test_game", "==", false).count().get();
    console.log(`verify: is_test_game == false now matches ${after.data().count} games`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
