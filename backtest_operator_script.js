/**
 * Replay OPERATOR_SCRIPT over every message that exists.
 *
 * This list is the only text signal allowed to ban somebody, so the bar is
 * absolute: every historical author of every phrase must be a confirmed
 * operator. One legitimate author means the phrase does not belong.
 *
 * Contrast with SPAM_SIGNATURE, which is broad by design: replayed over the
 * same corpus on 2026-09-16 it matched 79 authors, 66 of them legitimate
 * ("je t'ai envoyé un sms pour confirmer" is ordinary organiser talk). That is
 * why the broad signature alerts and this one acts.
 *
 * Run before adding any phrase. Read-only.
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const { OPERATOR_SCRIPT, SPAM_SIGNATURE } = require(
    path.join(__dirname, "../cloud-functions/functions/shared/spamSignature.js")
);

async function replay(label, rx) {
    const messages = await db.collection("messages")
        .select("text", "author_id", "created")
        .get();

    const byAuthor = new Map();
    messages.forEach((doc) => {
        const d = doc.data();
        if (!rx.test(d.text || "")) return;
        const uid = d.author_id?.id;
        if (!uid) return;
        if (!byAuthor.has(uid)) byAuthor.set(uid, []);
        byAuthor.get(uid).push({
            text: (d.text || "").slice(0, 130),
            when: d.created?.toDate?.(),
        });
    });

    const rows = [];
    for (const [uid, msgs] of byAuthor) {
        const snap = await db.collection("users").doc(uid).get();
        const u = snap.exists ? snap.data() : {};
        rows.push({
            uid,
            name: u.display_name,
            email: u.email,
            banned: u.banned === true,
            created: u.created_time?.toDate?.(),
            played: Array.isArray(u.played_games) ? u.played_games.length : 0,
            msgs,
        });
    }

    const clean = rows.filter((r) => !r.banned);
    console.log("=".repeat(70));
    console.log(`${label} — ${messages.size} messages scanned`);
    console.log("=".repeat(70));
    console.log(`${rows.length} distinct author(s): ${rows.length - clean.length} banned, ${clean.length} NOT banned\n`);

    rows.sort((a, b) => (a.created || 0) - (b.created || 0)).forEach((r) => {
        console.log(`  ${r.banned ? "BANNED " : ">>CLEAN"} ${r.uid} | ${r.name || "?"} | ${r.email || "?"}`);
        console.log(`     created ${r.created?.toISOString().slice(0, 16) || "?"} | played ${r.played} | ${r.msgs.length} msg(s)`);
        r.msgs.slice(0, 2).forEach((m) => console.log(`     "${m.text}"`));
    });

    console.log(clean.length === 0
        ? "\n  VERDICT: every author is a confirmed operator -> safe to ban on.\n"
        : `\n  VERDICT: ${clean.length} legitimate author(s) -> DO NOT ban on this. Alert only.\n`);

    return clean.length;
}

async function main() {
    const bad = await replay("OPERATOR_SCRIPT (the ban-capable list)", OPERATOR_SCRIPT);
    if (process.argv.includes("--compare")) {
        await replay("SPAM_SIGNATURE (broad, alert-only)", SPAM_SIGNATURE);
    }
    console.log(bad === 0
        ? "OPERATOR_SCRIPT is clean."
        : "OPERATOR_SCRIPT WOULD BAN REAL USERS — fix before deploying.");
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
