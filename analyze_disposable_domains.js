/**
 * Can the email domain carry more weight than one third of a conjunction?
 *
 * Why this matters now: on 2026-09-14 the operator published 96 minutes after
 * signup, which defeats FAST_SIGNUP_MINUTES=30 entirely. If the domain signal
 * is strong enough on its own, the gate stops depending on his timing -- which
 * he controls -- and depends on the throwaway mailbox, which is the thing he
 * actually needs.
 *
 * So the question is NOT "is dreameg.com disposable". It is:
 *
 *   Across all 108k users, who signs up with a throwaway domain, and are ANY
 *   of them legitimate?
 *
 * If the answer is "nobody legitimate, ever", the domain alone can gate game
 * creation regardless of timing. If real players use them, it stays one signal
 * among several.
 *
 * Read-only.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

// Mainstream consumer providers + Apple relay (anchored to one Apple ID, 20% of
// the base -- never treat as disposable).
const MAINSTREAM = new Set([
    "gmail.com", "googlemail.com",
    "hotmail.com", "hotmail.fr", "hotmail.be", "hotmail.es", "hotmail.it", "hotmail.co.uk",
    "outlook.com", "outlook.fr", "outlook.es", "outlook.it", "live.com", "live.fr", "live.be", "msn.com",
    "yahoo.com", "yahoo.fr", "yahoo.es", "yahoo.it", "yahoo.co.uk", "ymail.com",
    "icloud.com", "me.com", "mac.com", "privaterelay.appleid.com",
    "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr", "laposte.net", "bbox.fr",
    "numericable.fr", "neuf.fr", "aliceadsl.fr", "club-internet.fr", "voila.fr",
    "aol.com", "protonmail.com", "proton.me", "gmx.com", "gmx.fr", "gmx.de",
    "mail.com", "yandex.ru", "qq.com", "163.com", "web.de", "t-online.de",
    "libero.it", "virgilio.it", "alice.it", "tiscali.it", "telefonica.net",
]);

// Throwaway services. Keyword match on the domain, so subdomains count.
const DISPOSABLE_HINTS = [
    "mailinator", "guerrillamail", "yopmail", "10minutemail", "tempmail",
    "temp-mail", "throwaway", "trashmail", "sharklasers", "maildrop",
    "dispostable", "fakeinbox", "getnada", "mohmal", "emailondeck", "mailsac",
    "burnermail", "spamgourmet", "discard.email", "jetable", "tempr.email",
    "mailnesia", "mytemp", "tmpmail", "1secmail", "moakt", "inboxkitten",
    "minuteinbox", "mailcatch", "mintemail", "spam4", "trbvm", "yomail",
    // Observed on this operator's accounts.
    "crybio", "mail123", "bltiwd", "dreameg",
];

const isDisposable = (dom) => DISPOSABLE_HINTS.some((h) => dom.includes(h));

const iso = (d) => (d ? d.toISOString().slice(0, 10) : "?");

async function main() {
    console.log("Loading users...");
    const users = await db.collection("users")
        .select("email", "display_name", "banned", "created_time", "played_games",
                "positive_reports", "phone_number")
        .get();
    console.log(`${users.size} users.\n`);

    // Organizer counts, so "legitimate" can be judged on behaviour not vibes.
    console.log("Loading games...");
    const games = await db.collection("games").select("organizer").get();
    const orgCount = new Map();
    games.forEach((d) => {
        const o = d.data().organizer;
        if (typeof o === "string") orgCount.set(o, (orgCount.get(o) || 0) + 1);
    });
    console.log(`${games.size} games.\n`);

    const rows = [];
    const domainTally = new Map();

    users.forEach((doc) => {
        const u = doc.data();
        const dom = String(u.email || "").toLowerCase().split("@")[1];
        if (!dom) return;

        const e = domainTally.get(dom) || { n: 0, banned: 0 };
        e.n++; if (u.banned === true) e.banned++;
        domainTally.set(dom, e);

        if (!isDisposable(dom)) return;
        rows.push({
            uid: doc.id,
            name: u.display_name,
            email: u.email,
            dom,
            banned: u.banned === true,
            created: u.created_time?.toDate?.(),
            played: Array.isArray(u.played_games) ? u.played_games.length : 0,
            positive: Array.isArray(u.positive_reports) ? u.positive_reports.length : 0,
            organized: orgCount.get(doc.id) || 0,
        });
    });

    // ---- A. every disposable-domain account, ever ----------------------
    console.log("=".repeat(72));
    console.log("A. EVERY ACCOUNT ON A KNOWN THROWAWAY DOMAIN");
    console.log("=".repeat(72));
    rows.sort((a, b) => (a.created || 0) - (b.created || 0));
    const clean = rows.filter((r) => !r.banned);
    console.log(`${rows.length} account(s); ${rows.length - clean.length} banned, ${clean.length} NOT banned.\n`);
    for (const r of rows) {
        console.log(`  ${r.banned ? "BANNED " : ">>CLEAN"} ${r.email}`);
        console.log(`     ${r.uid} | ${r.name} | created ${iso(r.created)}`);
        console.log(`     played=${r.played} organized=${r.organized} positive=${r.positive}`);
    }

    console.log(`\n  VERDICT: ${clean.length === 0
        ? "no legitimate account has EVER used a throwaway domain."
        : `${clean.length} unbanned account(s) -- inspect each before trusting the domain alone.`}`);

    // ---- B. would domain-alone have any collateral? --------------------
    console.log(`\n${"=".repeat(72)}`);
    console.log("B. IF DOMAIN ALONE GATED GAME CREATION");
    console.log("=".repeat(72));
    const wouldBan = rows.filter((r) => r.organized > 0);
    const wouldBanClean = wouldBan.filter((r) => !r.banned);
    console.log(`${wouldBan.length} throwaway-domain account(s) have organized a game.`);
    console.log(`${wouldBanClean.length} of those are NOT banned.\n`);
    for (const r of wouldBanClean) {
        console.log(`  >>CLEAN ${r.email} | ${r.organized} game(s) | played=${r.played}`);
    }
    if (!wouldBanClean.length) {
        console.log("  -> Every throwaway-domain account that ever organized a game is banned.");
        console.log("     Domain alone would have had ZERO false positives historically.");
    }

    // ---- C. suspicious domains we have NOT listed ----------------------
    // A throwaway domain used once or twice, never by an established user, is
    // what the next unknown service looks like before we know its name.
    console.log(`\n${"=".repeat(72)}`);
    console.log("C. UNLISTED RARE DOMAINS WITH A HIGH BAN RATE");
    console.log("   (candidate throwaway services we have not named yet)");
    console.log("=".repeat(72));
    const suspects = [...domainTally.entries()]
        .filter(([d, e]) => !MAINSTREAM.has(d) && !isDisposable(d) && e.banned > 0 && e.n <= 5)
        .sort((a, b) => (b[1].banned / b[1].n) - (a[1].banned / a[1].n) || b[1].banned - a[1].banned);
    if (!suspects.length) console.log("  none");
    suspects.slice(0, 25).forEach(([d, e]) =>
        console.log(`  ${d.padEnd(34)} ${e.n} account(s), ${e.banned} banned (${Math.round(100 * e.banned / e.n)}%)`));

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
