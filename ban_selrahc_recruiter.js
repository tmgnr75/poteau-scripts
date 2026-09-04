/**
 * Ban Selrahc (KtiFZn0XboUoofGbUoULf2oaFrC2) for external-recruiter spam, and
 * cancel the fake games he published.
 *
 * WHY
 *
 * From 2026-09-02 he published games at Camp des Loges whose description ends
 * "le match indiqué sur l'app n'aura pas lieu" and funnels players to his own
 * phone number to recruit for an outside championship team. Nine real users
 * joined games that were never going to happen; he swept every +1 and worked
 * the chat one by one. Same class as the FootFactory / competitor-recruiter
 * sweeps: the platform is being used as a lead list.
 *
 * This is NOT a user report, so the "a report can never ban anyone" invariant
 * does not apply -- the evidence is the content he published himself.
 *
 * SCOPE
 *
 * Cancels only FUTURE games. Past games are never touched: a ban that rewrites
 * history was the 2026-08 incident, and ~45 of his games were genuinely played.
 * Repeaters are handled by pause_repeaters_of_banned_users.js --uid=..., which
 * must run AFTER this script (it selects on banned === true).
 *
 * DRY BY DEFAULT. Pass --write to apply.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
}
const db = admin.firestore();

const WRITE = process.argv.includes("--write");
const UID = "KtiFZn0XboUoofGbUoULf2oaFrC2";

(async () => {
    const userRef = db.collection("users").doc(UID);
    const user = await userRef.get();
    if (!user.exists) throw new Error(`user ${UID} not found`);
    console.log(`user: ${user.get("display_name")} <${user.get("email")}> banned=${user.get("banned")}`);

    const now = new Date();
    const snap = await db.collection("games").where("organizer", "==", UID).get();
    const live = snap.docs.filter(g => {
        const date = g.get("date");
        return date && date.toDate() > now && ["published", "hidden"].includes(g.get("status"));
    });

    console.log(`\nfuture live games to cancel: ${live.length} (of ${snap.size} organized)`);
    for (const g of live) {
        const spam = /n'aura pas lieu|recherche joueurs/i.test(g.get("description") || "");
        const attendees = new Set((g.get("attendees") || []).map(r => r.id || r));
        attendees.delete(UID);
        console.log(`  ${g.id} ${g.get("date").toDate().toISOString().slice(0, 16)}` +
            `${spam ? " SPAM" : "     "} real_joiners=${attendees.size}`);
    }

    if (!WRITE) {
        console.log(`\nDRY RUN — would set banned=true and cancel ${live.length} games`);
        process.exit(0);
    }

    await userRef.update({ banned: true });
    let canceled = 0;
    for (const g of live) {
        await g.ref.update({ status: "canceled" });
        canceled++;
    }
    console.log(`\nAPPLIED — banned=true, games canceled: ${canceled}`);
    process.exit(0);
})();
