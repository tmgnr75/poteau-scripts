/**
 * Round 7 — "Aaa" / arthurthomas@mail123.pro, found 2026-09-14.
 *
 * Re-registered ~2h17m after round 6 was banned. Same display name, same
 * disposable domain (mail123.pro), same venue (UrbanSoccer - Asnières), same
 * 4-minute signup->game gap. Found by the newGameGate backtest, not by the
 * message detector: the account has written nothing of its own, so there is no
 * text to classify.
 *
 * Uses the SAME ban path the Slack button uses (shared/spamBan.js), so the
 * result is identical to a moderator click: banned + banned_by/banned_at,
 * Auth disabled, high-severity messages deleted, refs scrubbed off games,
 * upcoming published games cancelled.
 *
 * Dry by default. EXECUTE=1 to apply. Idempotent.
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const { applySpamBan } = require(
    path.join(__dirname, "../cloud-functions/functions/shared/spamBan.js")
);

const TARGETS = ["r1WCywKxsydZDnoppPW0Mkjjveq2"];
const EXECUTE = process.env.EXECUTE === "1";

async function main() {
    console.log(EXECUTE ? "=== EXECUTE ===\n" : "=== DRY RUN (EXECUTE=1 to apply) ===\n");

    for (const uid of TARGETS) {
        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) { console.log(`${uid}: NOT FOUND`); continue; }
        const d = snap.data();

        console.log(`${uid} | ${d.display_name} | ${d.email} | ${d.phone_number}`);
        console.log(`   created ${d.created_time?.toDate?.().toISOString()} | banned=${d.banned}`);

        const games = await db.collection("games").where("organizer", "==", uid).get();
        const upcoming = games.docs.filter((g) => {
            const x = g.data();
            return x.status === "published" && (x.date?.toDate?.() || 0) > new Date();
        });
        console.log(`   ${games.size} game(s), ${upcoming.length} upcoming published:`);
        upcoming.forEach((g) => {
            const x = g.data();
            const att = Array.isArray(x.attendees) ? new Set(x.attendees.map((r) => r.id || r)).size : 0;
            console.log(`      ${g.id} ${x.date?.toDate?.().toISOString().slice(0, 16)} ${x.centre} ${att}/${x.max_players}`);
        });

        if (d.banned === true) { console.log("   already banned, skipping\n"); continue; }

        if (!EXECUTE) { console.log("   would ban\n"); continue; }

        const r = await applySpamBan({
            db, admin, uid,
            bannedBy: "tim (round7 manual)",
            logPrefix: `[ban_round7] [${uid}]`,
        });
        console.log(`   BANNED: ${r.deleted} message(s) deleted, ${r.canceledGames}/${r.totalGames} game(s) cancelled\n`);
    }

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
