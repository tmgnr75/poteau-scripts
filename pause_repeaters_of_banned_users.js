/**
 * Pause the repeaters owned by banned users, and cancel any future games those
 * repeaters already generated.
 *
 * WHY THIS EXISTS
 *
 * `scheduleGames` selects repeaters on `status == 'published'` alone and never
 * checks the organizer's `banned` flag. Before the 2026-08-18 fix in
 * index.js (pauseRepeatersOwnedBy), banning a user cancelled their existing
 * games but left the repeater running, so the ladder refilled the cancelled
 * weeks the next morning. This script cleans up the ones already in that state.
 *
 * Repeaters are PAUSED, not deleted -- same status the captain's own "Mettre en
 * pause" writes, and reversible if an appeal restores access.
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
// Optional: restrict to one uid, e.g. `node ... --uid=FesmA7X0...`
const uidArg = process.argv.find(a => a.startsWith("--uid="));
const ONLY_UID = uidArg ? uidArg.split("=")[1] : null;

(async () => {
    const snap = await db.collection("repeaters").where("status", "==", "published").get();
    console.log(`published repeaters: ${snap.size}`);

    // Cache organizer lookups: many repeaters share an owner.
    const cache = new Map();
    async function isBanned(uid) {
        if (!cache.has(uid)) {
            const u = await db.collection("users").doc(uid).get();
            cache.set(uid, u.exists && u.data().banned === true);
        }
        return cache.get(uid);
    }

    const now = new Date();
    let paused = 0, gamesCanceled = 0;

    for (const doc of snap.docs) {
        const organizer = doc.get("organizer");
        if (!organizer || typeof organizer !== "string") continue;
        if (ONLY_UID && organizer !== ONLY_UID) continue;
        if (!(await isBanned(organizer))) continue;

        console.log(`\nrepeater ${doc.id} owner=${organizer} centre=${JSON.stringify(doc.get("centre"))}`);

        // Future games this repeater already produced and that are still live.
        const fg = await db.collection("games")
            .where("repeater", "==", doc.ref)
            .where("date", ">", now)
            .get();
        const live = fg.docs.filter(g => ["published", "hidden"].includes(g.get("status")));

        if (WRITE) {
            await doc.ref.update({
                status: "paused",
                paused_reason: "organizer_banned",
                paused_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            for (const g of live) {
                await g.ref.update({ status: "canceled" });
                gamesCanceled++;
            }
        } else {
            gamesCanceled += live.length;
        }
        paused++;
        console.log(`  ${WRITE ? "PAUSED" : "would pause"}; future live games ${WRITE ? "canceled" : "to cancel"}: ${live.length}`);
    }

    console.log(`\n${WRITE ? "APPLIED" : "DRY RUN"} — repeaters: ${paused}, games: ${gamesCanceled}`);
    process.exit(0);
})();
