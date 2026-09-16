/**
 * Purge the `pending_referrals` collection.
 *
 * WHY
 *
 * Every document holds the phone number of somebody who never signed up for
 * Poteau. They never gave it to us -- a user typed it in to refer them -- so
 * there is no lawful basis for holding it, no retention limit was ever applied,
 * and the person has no way to know it exists or to ask for it to be removed.
 *
 * Measured 2026-09-16: 1,463 documents, all with a phone number, 1,221 still
 * `pending` and 242 `successful`. Oldest 2024-10-28, newest 2025-12-02.
 *
 * WHY DELETE RATHER THAN STRIP THE PHONE
 *
 * The phone number IS the document. What remains once it is gone -- a status, a
 * date, a list of referrer ids -- describes a referral to a person who can no
 * longer be identified, and nothing reads it. The 242 conversions are all over a
 * year old and already counted in the user base.
 *
 * The Cloud Function that sent SMS to these numbers (sendSmsToReferredFriend)
 * was removed from index.js in the same change.
 *
 * USAGE
 *
 *   node purge_referral_phones.js           # dry run, writes nothing
 *   node purge_referral_phones.js --apply   # delete
 */

const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.join(__dirname, "..", "krank-club-firebase-adminsdk-bl4zy-d8facdf022.json"));

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");

async function main() {
    console.log(APPLY ? "=== APPLY MODE ===" : "=== DRY RUN ===");

    const snap = await db.collection("pending_referrals").get();
    console.log(`pending_referrals documents: ${snap.size}`);

    let withPhone = 0;
    const byStatus = new Map();
    snap.forEach((d) => {
        if (d.get("phone")) withPhone++;
        const s = d.get("status") === undefined ? "(unset)" : String(d.get("status"));
        byStatus.set(s, (byStatus.get(s) || 0) + 1);
    });

    console.log(`  holding a phone number: ${withPhone}`);
    [...byStatus.entries()].forEach(([k, v]) => console.log(`  status ${k}: ${v}`));

    if (!APPLY) {
        console.log("");
        console.log(`Run with --apply to delete all ${snap.size} documents.`);
        process.exit(0);
    }

    let deleted = 0;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
        const batch = db.batch();
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
        deleted += Math.min(400, docs.length - i);
        console.log(`  deleted ${deleted}/${docs.length}`);
    }

    console.log("");
    console.log(`Done. Deleted ${deleted} documents.`);
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
