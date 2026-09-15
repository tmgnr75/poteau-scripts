/**
 * Verify the signup blocklist against every account that exists.
 *
 * Run this BEFORE deploying any change to DISPOSABLE_EMAIL_DOMAINS. The list
 * gates account creation, so an over-broad entry does not merely mis-flag
 * someone -- it stops a real player from ever signing up, silently, with no
 * resend path and no error message.
 *
 * Prints what the list would have refused historically, split into:
 *   - banned accounts   (correct refusals)
 *   - unbanned accounts (real people who would have been turned away)
 *
 * Read-only.
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const {
    isDisposableEmail,
    DISPOSABLE_EMAIL_DOMAINS,
} = require(path.join(__dirname, "../cloud-functions/functions/shared/spamSignature.js"));

async function main() {
    console.log(`Blocklist has ${DISPOSABLE_EMAIL_DOMAINS.length} entries.\n`);

    const users = await db.collection("users")
        .select("email", "display_name", "banned", "created_time",
                "played_games", "positive_reports", "is_test_account")
        .get();
    console.log(`Scanned ${users.size} users.\n`);

    const games = await db.collection("games").select("organizer").get();
    const orgCount = new Map();
    games.forEach((d) => {
        const o = d.data().organizer;
        if (typeof o === "string") orgCount.set(o, (orgCount.get(o) || 0) + 1);
    });

    const blocked = [];
    users.forEach((doc) => {
        const u = doc.data();
        if (!isDisposableEmail(u.email)) return;
        blocked.push({
            uid: doc.id,
            email: u.email,
            name: u.display_name,
            banned: u.banned === true,
            isTest: u.is_test_account === true,
            created: u.created_time?.toDate?.(),
            played: Array.isArray(u.played_games) ? u.played_games.length : 0,
            positive: Array.isArray(u.positive_reports) ? u.positive_reports.length : 0,
            organized: orgCount.get(doc.id) || 0,
        });
    });

    const bad = blocked.filter((r) => r.banned);
    const good = blocked.filter((r) => !r.banned);

    console.log("=".repeat(70));
    console.log(`WOULD HAVE REFUSED ${blocked.length} SIGNUPS`);
    console.log("=".repeat(70));
    console.log(`  ${bad.length} banned  (correct)`);
    console.log(`  ${good.length} NOT banned  (real people turned away)\n`);

    if (good.length) {
        console.log("--- the unbanned ones, most active first ---");
        good.sort((a, b) => b.organized - a.organized || b.positive - a.positive);
        for (const r of good) {
            const flag = r.isTest ? "TEST " : "     ";
            console.log(`  ${flag}${r.email}`);
            console.log(`        organized=${r.organized} played=${r.played} positive=${r.positive} — ${r.name || "?"}`);
        }
        console.log("");
    }

    // Any test account caught here would break the seeding/testing workflow.
    const tests = blocked.filter((r) => r.isTest);
    console.log(tests.length === 0
        ? "No provisioned test account is affected."
        : `WARNING: ${tests.length} test account(s) would be refused — fix before deploying.`);

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
