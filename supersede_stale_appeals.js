/**
 * Retire appeal docs that outlived the ban they contested.
 *
 * THE BUG
 *
 * The ban screen offers "Appeal this decision" only when the user has no appeal
 * doc at all — no status filter, deliberately, so a rejected appeal cannot be
 * resubmitted until the answer changes. Its comment says "one appeal per person
 * UNTIL THEY ARE UNBANNED", but nothing ever implemented that second half: the
 * doc outlived the ban.
 *
 * So anyone who appealed, was let back in, and was banned again found the button
 * gone and the screen telling them their appeal had been received. Locked out
 * AND silenced, with the app reporting a pending review that had been decided
 * weeks earlier. Jérémie (Km0imfrnz8gFFIbUZnCBq6y400h1) emailed support asking
 * why nobody had answered; his appeal had been granted 16 days before.
 *
 * `supersedeAppeals()` in cloud-functions/shared/cards.js now stamps
 * `superseded_at` on every unban. This script applies the same stamp to the
 * backlog that predates it.
 *
 * WHAT COUNTS AS STALE
 *
 * An appeal whose owner is NOT currently banned. Not "status granted": a
 * rejected appeal on someone later unbanned by hand is equally stale, and a
 * granted appeal on someone re-banned since is NOT — that one belongs to a live
 * lockout and must keep blocking a duplicate.
 *
 * Marking, never deleting: `status` records what a moderator decided and the
 * Slack alert counts a user's prior appeals. Both survive.
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

const fr = (d) =>
    d ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(d) : "-";

(async () => {
    const snap = await db.collection("appeals").get();
    console.log(`appeals in collection: ${snap.size}`);

    // Resolve each appeal's owner once, even when someone appealed twice.
    const byUser = new Map();
    for (const doc of snap.docs) {
        const userRef = doc.get("user");
        if (!userRef || !userRef.id) continue;
        if (!byUser.has(userRef.id)) byUser.set(userRef.id, { ref: userRef, appeals: [] });
        byUser.get(userRef.id).appeals.push(doc);
    }
    console.log(`distinct users: ${byUser.size}`);

    const userRefs = [...byUser.values()].map((v) => v.ref);
    const userSnaps = [];
    // getAll caps at 300 refs per call.
    for (let i = 0; i < userRefs.length; i += 300) {
        userSnaps.push(...(await db.getAll(...userRefs.slice(i, i + 300))));
    }
    const bannedById = new Map(userSnaps.map((s) => [s.id, s.get("banned") === true]));

    const stale = [];
    let alreadyDone = 0;
    let stillBanned = 0;

    for (const [uid, { appeals }] of byUser) {
        const banned = bannedById.get(uid);
        for (const doc of appeals) {
            if (doc.get("superseded_at")) {
                alreadyDone++;
                continue;
            }
            // A live lockout keeps its appeal: it is still the thing blocking a
            // duplicate submission, which is what the screen wants.
            if (banned) {
                stillBanned++;
                continue;
            }
            stale.push({ doc, uid, status: doc.get("status") || "new" });
        }
    }

    console.log(`\nalready superseded: ${alreadyDone}`);
    console.log(`kept (user still banned): ${stillBanned}`);
    console.log(`TO SUPERSEDE (user has access, appeal is dead weight): ${stale.length}\n`);

    const byStatus = {};
    for (const s of stale) byStatus[s.status] = (byStatus[s.status] || 0) + 1;
    console.log(`by status: ${JSON.stringify(byStatus)}\n`);

    for (const s of stale.slice(0, 20)) {
        console.log(`  ${s.doc.id}  ${s.uid}  ${s.status.padEnd(9)}  created ${fr(s.doc.get("created")?.toDate())}`);
    }
    if (stale.length > 20) console.log(`  … and ${stale.length - 20} more`);

    if (!WRITE) {
        console.log(`\nDRY RUN. Re-run with --write to apply.`);
        process.exit(0);
    }

    let written = 0;
    for (let i = 0; i < stale.length; i += 400) {
        const batch = db.batch();
        for (const s of stale.slice(i, i + 400)) {
            batch.update(s.doc.ref, {
                superseded_at: admin.firestore.FieldValue.serverTimestamp(),
                superseded_by: "backfill_2026-09-10",
            });
            written++;
        }
        await batch.commit();
    }
    console.log(`\nsuperseded ${written} appeal(s). Those users can appeal again if re-banned.`);
    process.exit(0);
})().catch((e) => {
    console.error("ERR", e);
    process.exit(1);
});
