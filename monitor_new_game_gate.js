/**
 * Monitor the newGameGate auto-ban after deploy (2026-09-14).
 *
 * The gate bans an account that has posted nothing, so the thing worth watching
 * is not "did it fire" but "did it fire on someone real". Two failure modes,
 * and they look different in the data:
 *
 *   FALSE POSITIVE — a banned account whose game had players already joined,
 *                    or whose email domain is not one of ours. Loud.
 *   SILENT MISS    — a new account 3/3 by the same rules that is NOT banned,
 *                    i.e. the gate did not run. That is what a missing secret
 *                    or a swallowed error looks like from outside.
 *
 * Read-only. Safe to run repeatedly.
 */
const path = require("path");
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: "krank-club" });
const db = admin.firestore();

const { evaluateNewGameGate, hasNoHistory } = require(
    path.join(__dirname, "../cloud-functions/functions/shared/newGameGate.js")
);

// Deploy time. Anything before this the gate could not have seen.
const DEPLOYED_AT = new Date("2026-09-14T20:34:00Z");
const LOOKBACK_HOURS = Number(process.env.HOURS || 24);

const iso = (d) => (d ? d.toISOString().replace("T", " ").slice(0, 16) : "?");

async function main() {
    const since = new Date(Math.max(
        DEPLOYED_AT.getTime(),
        Date.now() - LOOKBACK_HOURS * 3600 * 1000
    ));
    console.log(`=== newGameGate monitor — games created since ${iso(since)} ===\n`);

    const games = await db.collection("games")
        .where("created_on", ">=", admin.firestore.Timestamp.fromDate(since))
        .select("organizer", "centre", "created_on", "status", "attendees", "max_players", "date")
        .get();
    console.log(`${games.size} game(s) created in window.\n`);

    const banned = [];
    const missed = [];

    for (const doc of games.docs) {
        const g = doc.data();
        const uid = g.organizer;
        if (!uid || typeof uid !== "string") continue;

        const snap = await db.collection("users").doc(uid).get();
        if (!snap.exists) continue;
        const p = snap.data();

        const verdict = evaluateNewGameGate({
            profile: p,
            centre: g.centre,
            gameCreatedAt: g.created_on?.toDate?.() || new Date(),
        });
        if (!verdict.matched || !hasNoHistory(p)) continue;

        const att = Array.isArray(g.attendees)
            ? new Set(g.attendees.map((r) => r.id || r)).size : 0;

        const row = {
            uid, gameId: doc.id,
            name: p.display_name, email: p.email,
            centre: g.centre, status: g.status,
            attendees: att, max: g.max_players,
            created: g.created_on?.toDate?.(),
            bannedBy: p.banned_by, bannedAt: p.banned_at?.toDate?.(),
            signals: verdict.signals,
        };
        (p.banned === true ? banned : missed).push(row);
    }

    console.log(`--- FIRED (${banned.length}) ---`);
    for (const r of banned) {
        console.log(`  ${r.uid} | ${r.name} | ${r.email}`);
        console.log(`     game ${r.gameId} @ ${r.centre} — ${r.status}, ${r.attendees}/${r.max} players`);
        console.log(`     banned_by=${r.bannedBy} at ${iso(r.bannedAt)}`);
        console.log(`     signals: ${r.signals.join(", ")}`);
        // A game that already had players when it was cancelled is the one
        // shape worth a human look: the operator's games are empty at +4min.
        if (r.attendees > 1) console.log(`     ⚠ ${r.attendees} players had joined — CHECK THIS ONE`);
        console.log("");
    }
    if (!banned.length) console.log("  (none)\n");

    console.log(`--- 3/3 BUT NOT BANNED (${missed.length}) ---`);
    if (missed.length) {
        console.log("  The gate should have fired on these and did not.");
        console.log("  Check publishGame logs for 'newGameGate failed' and confirm");
        console.log("  the three SLACK_* secrets are on the deployed revision.\n");
        for (const r of missed) {
            console.log(`  ${r.uid} | ${r.name} | ${r.email}`);
            console.log(`     game ${r.gameId} @ ${r.centre} — created ${iso(r.created)}`);
            console.log(`     signals: ${r.signals.join(", ")}\n`);
        }
    } else {
        console.log("  (none — no silent misses)\n");
    }

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
