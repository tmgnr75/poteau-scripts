/**
 * Process the historical backlog of unhonoured account-deletion requests.
 *
 * BACKGROUND
 *
 * "Supprimer mon compte" wrote a `connect` document with source: "deletion" and
 * never deleted anything. Measured 2026-09-16: 2,460 people had asked, 2,442
 * still had a full account. The oldest request is from 2023-08-09.
 *
 * THE THREE COHORTS
 *
 * Not everyone who ever tapped that button still wants to be deleted, and acting
 * on a three-year-old request against someone who played last week would be its
 * own kind of wrong.
 *
 *   A. Used the app AFTER their last request  (621 people, 217 active in the
 *      last 30 days). Their request is treated as OBSOLETE: they came back, and
 *      in several cases they came back because the button did nothing. One
 *      person asked 23 times and was active the day this was written. Their
 *      tickets are cleared, their accounts are kept.
 *
 *   B. No activity since their request        (1,672 people). These are the real
 *      unhonoured requests. Deleted.
 *
 *   C. Never active at all                    (149 people). Deleted.
 *
 * The cutoff between A and B is one hour after the request, because the sign-out
 * that followed the old flow could itself stamp an activity date.
 *
 * USAGE
 *
 *   node process_deletion_backlog.js              # dry run, writes nothing
 *   node process_deletion_backlog.js --apply      # actually deletes
 *   node process_deletion_backlog.js --apply --limit 50
 *
 * Always run the dry run first and read the cohort counts.
 */

const path = require("path");

// The functions tree has its own firebase-admin copy in its own node_modules.
// shared/accountDeletion.js requires gen2/admin.js, which calls
// initializeApp() with NO credentials -- correct inside Cloud Functions, fatal
// in a script. Its `if (!admin.apps.length)` guard is the way in: initialise
// THAT copy of the module, with a service account, before anything requires it.
//
// Loading firebase-admin from the functions directory rather than from
// scripts/ matters. Two copies of the library keep separate `admin.apps`
// registries, so initialising the scripts/ copy would leave the functions/
// copy uninitialised and every deletion would fail on default credentials.
const FUNCTIONS_DIR = path.resolve(__dirname, "../../cloud-functions/functions");
const admin = require(path.join(FUNCTIONS_DIR, "node_modules/firebase-admin"));
const sa = require(path.join(__dirname, "..", "krank-club-firebase-adminsdk-bl4zy-d8facdf022.json"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId: "krank-club",
        storageBucket: "krank-club.appspot.com",
    });
}

const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1], 10) : Infinity;

// Activity strictly after (request + this) means they came back.
const RETURN_GRACE_MS = 60 * 60 * 1000;
// Dates at or before this are the "never reached Home" sentinel, not real activity.
const SENTINEL_CUTOFF = new Date("2000-01-01").getTime();

const ms = (ts) => (ts && typeof ts.toDate === "function" ? ts.toDate().getTime() : null);

async function main() {
    console.log(APPLY ? "=== APPLY MODE: accounts will be deleted ===" : "=== DRY RUN: nothing will be written ===");
    console.log("");

    const snap = await db.collection("connect").where("source", "==", "deletion").get();

    // Latest request per user, and every ticket so they can be cleared.
    const lastAsk = new Map();
    const ticketsByUser = new Map();
    snap.forEach((d) => {
        const data = d.data();
        const uid = data.sender && data.sender.id;
        if (!uid) return;
        const t = ms(data.datetime);
        if (!ticketsByUser.has(uid)) ticketsByUser.set(uid, []);
        ticketsByUser.get(uid).push(d.ref);
        if (t !== null && (!lastAsk.has(uid) || t > lastAsk.get(uid))) lastAsk.set(uid, t);
    });

    console.log(`Deletion tickets: ${snap.size} from ${ticketsByUser.size} distinct users`);

    const uids = [...ticketsByUser.keys()];
    const cohortA = [];
    const cohortBC = [];
    const gone = [];

    for (let i = 0; i < uids.length; i += 200) {
        const chunk = uids.slice(i, i + 200);
        const docs = await db.getAll(...chunk.map((u) => db.doc(`users/${u}`)));
        docs.forEach((doc, idx) => {
            const uid = chunk[idx];
            if (!doc.exists) {
                gone.push(uid);
                return;
            }
            const asked = lastAsk.get(uid) ?? 0;
            const act = ms(doc.get("last_activity_date"));
            const realActivity = act !== null && act > SENTINEL_CUTOFF;

            if (realActivity && act > asked + RETURN_GRACE_MS) {
                cohortA.push({ uid, name: doc.get("display_name") || null, activity: new Date(act).toISOString() });
            } else {
                cohortBC.push({ uid, name: doc.get("display_name") || null, email: doc.get("email") || null });
            }
        });
    }

    console.log("");
    console.log(`  A. came back after asking (keep, clear tickets): ${cohortA.length}`);
    console.log(`  B+C. still want out (delete):                    ${cohortBC.length}`);
    console.log(`  already gone from Firestore:                     ${gone.length}`);
    console.log("");

    if (!APPLY) {
        console.log("Sample of accounts that WOULD be deleted:");
        cohortBC.slice(0, 10).forEach((u) => console.log(`  ${u.uid}  ${JSON.stringify(u.name)}  ${u.email || "(no email)"}`));
        console.log("");
        console.log(`Run with --apply to delete ${cohortBC.length} accounts.`);
        process.exit(0);
    }

    // Cohort A: the request is obsolete because they came back. Clear the
    // tickets so the monthly sweep does not keep seeing them.
    let clearedTickets = 0;
    for (const { uid } of cohortA) {
        const refs = ticketsByUser.get(uid) || [];
        for (let i = 0; i < refs.length; i += 400) {
            const batch = db.batch();
            refs.slice(i, i + 400).forEach((r) => batch.delete(r));
            await batch.commit();
            clearedTickets += Math.min(400, refs.length - i);
        }
    }
    console.log(`Cleared ${clearedTickets} obsolete tickets for ${cohortA.length} returning users.`);
    console.log("");

    // Cohorts B and C: delete for real.
    const { deleteAccount } = require(path.join(FUNCTIONS_DIR, "shared/accountDeletion.js"));

    let done = 0;
    let failed = 0;
    const toDelete = cohortBC.slice(0, LIMIT === Infinity ? cohortBC.length : LIMIT);

    for (const { uid, name } of toDelete) {
        try {
            const report = await deleteAccount(uid, { reason: "user_request_backlog" });
            const refs = ticketsByUser.get(uid) || [];
            for (let i = 0; i < refs.length; i += 400) {
                const batch = db.batch();
                refs.slice(i, i + 400).forEach((r) => batch.delete(r));
                await batch.commit();
            }
            done++;
            if (report.errors.length > 0) {
                console.log(`  ${uid} deleted WITH ERRORS: ${report.errors.join("; ")}`);
            }
            if (done % 25 === 0) console.log(`  ... ${done}/${toDelete.length}`);
        } catch (err) {
            failed++;
            console.error(`  FAILED ${uid} ${JSON.stringify(name)}: ${err.message}`);
        }
    }

    console.log("");
    console.log(`Deleted: ${done}`);
    console.log(`Failed:  ${failed}`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
