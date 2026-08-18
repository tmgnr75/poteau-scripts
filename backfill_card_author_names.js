/**
 * Backfill `author_name` on card messages to the player's display_name.
 *
 * Card messages were written with `first_name || display_name`; that order was
 * inverted on 2026-08-18 (cloud-functions shared/cards.js) because
 * `display_name` is the name the game chat shows on every other message.
 *
 * ONLY `author_name` IS FIXED. The message BODY ("Carton jaune pour X") baked
 * the old name into four language strings at write time. It is left alone:
 * rewriting historical chat text would edit what players were actually told,
 * and these messages are months old and already read.
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

const TRIGGERS = ["late_unapply_yellow_card", "late_unapply_red_card"];

(async () => {
    const docs = [];
    for (const t of TRIGGERS) {
        const s = await db.collection("messages").where("trigger", "==", t).get();
        s.forEach(d => docs.push(d));
    }
    console.log(`card messages: ${docs.length}`);

    const cache = new Map();
    let changed = 0, skipped = 0;

    for (const d of docs) {
        const authorId = d.get("author_id");
        const uid = authorId && authorId.id;
        if (!uid) { skipped++; continue; }

        if (!cache.has(uid)) {
            const u = await db.collection("users").doc(uid).get();
            cache.set(uid, u.exists ? u.data() : null);
        }
        const user = cache.get(uid);
        if (!user) { skipped++; continue; }

        const want = user.display_name || user.first_name || "";
        const have = d.get("author_name") || "";
        if (want === have || !want) { skipped++; continue; }

        console.log(`${d.id}: ${JSON.stringify(have)} -> ${JSON.stringify(want)}`);
        if (WRITE) await d.ref.update({ author_name: want });
        changed++;
    }

    console.log(`\n${WRITE ? "APPLIED" : "DRY RUN"} — changed: ${changed}, unchanged: ${skipped}`);
    process.exit(0);
})();
