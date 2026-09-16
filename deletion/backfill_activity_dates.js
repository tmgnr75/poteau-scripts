/**
 * Repair `last_activity_date` on accounts that carry the epoch sentinel.
 *
 * WHAT THE SENTINEL MEANS
 *
 * 8,382 user documents have `last_activity_date` set to exactly 1970-01-01,
 * and ~3,000 more have no value at all. These are NOT corrupt records and NOT
 * "dormant, date unknown". Verified 2026-09-16:
 *
 *   - `played_games` is empty for every single one of them
 *   - only 36 of 8,382 have an `app_version` at all
 *   - 7,420 have no game in `games` either
 *   - `created_time` is 2023 or 2024 for all of them
 *
 * The field is stamped by the Home and Games pages (see
 * poteau-app/lib/pages/4_super_bar/*), so an account that never reached either
 * screen keeps the default. The sentinel therefore means exactly one thing:
 * "registered, never used the app".
 *
 * WHY IT MUST BE REPAIRED BEFORE RETENTION RUNS
 *
 * A retention sweep keyed on this field would read 1970 as fifty-six years of
 * inactivity and delete all 8,382 on its first run, with no warning email
 * possible -- while missing every genuinely dormant account whose date is real.
 * Backfilling from `created_time` gives each one an honest clock start, so the
 * normal 3-year rule and its warning email apply to them like anyone else.
 *
 * WHY NOT JUST LEAVE THEM
 *
 * They are the clearest cohort of abandoned accounts in the database, and their
 * personal data (email, name, and for some a phone number) has been held for
 * two to three years with no use and no retention limit. They are precisely who
 * a retention policy exists for.
 *
 * WHAT THIS WRITES
 *
 * `last_activity_date` = `created_time`, and a `activity_backfilled_at` marker
 * so a later reader can tell a backfilled value from a real one. Nothing else
 * is touched, and no account is deleted here.
 *
 * USAGE
 *
 *   node backfill_activity_dates.js            # dry run
 *   node backfill_activity_dates.js --apply
 */

const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.join(__dirname, "..", "krank-club-firebase-adminsdk-bl4zy-d8facdf022.json"));

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const SENTINEL_CUTOFF = new Date("2000-01-01").getTime();

async function main() {
    console.log(APPLY ? "=== APPLY MODE ===" : "=== DRY RUN ===");

    const snap = await db.collection("users")
        .select("last_activity_date", "created_time", "games", "type")
        .get();

    const fixable = [];
    let alreadyFine = 0;
    let noCreatedTime = 0;
    let proSkipped = 0;

    snap.forEach((doc) => {
        const type = doc.get("type");
        if (type === "pro" || type === "super_pro") { proSkipped++; return; }

        const la = doc.get("last_activity_date");
        const t = la && typeof la.toDate === "function" ? la.toDate().getTime() : null;
        if (t !== null && t > SENTINEL_CUTOFF) { alreadyFine++; return; }

        const ct = doc.get("created_time");
        if (!ct || typeof ct.toDate !== "function") { noCreatedTime++; return; }

        fixable.push({ ref: doc.ref, created: ct });
    });

    console.log(`  scanned:                    ${snap.size}`);
    console.log(`  already have a real date:   ${alreadyFine}`);
    console.log(`  pro accounts skipped:       ${proSkipped}`);
    console.log(`  no created_time, untouched: ${noCreatedTime}`);
    console.log(`  to backfill:                ${fixable.length}`);

    if (!APPLY) {
        console.log("");
        console.log(`Run with --apply to backfill ${fixable.length} documents.`);
        process.exit(0);
    }

    let written = 0;
    for (let i = 0; i < fixable.length; i += 400) {
        const batch = db.batch();
        fixable.slice(i, i + 400).forEach(({ ref, created }) => {
            batch.update(ref, {
                last_activity_date: created,
                activity_backfilled_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        await batch.commit();
        written += Math.min(400, fixable.length - i);
        console.log(`  ${written}/${fixable.length}`);
    }

    console.log("");
    console.log(`Done. Backfilled ${written} documents.`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
