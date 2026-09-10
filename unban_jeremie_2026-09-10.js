/**
 * Reinstate Jérémie / "Azé" (Km0imfrnz8gFFIbUZnCBq6y400h1) — final chance.
 *
 * WHY
 *
 * Banned 2026-09-04 by the automatic ladder: two standing yellows make a red.
 * All three of his cards are `late_unapply`, measured by the backend. No player
 * has ever reported him: 89 positive reports, 1 rude report, 96 games since
 * May 2025.
 *
 *   25/08  LE FIVE Marville          left 13 min before kickoff  🟨 (removed 26/08)
 *   31/08  LE FIVE Paris 18          left 47 min before kickoff  🟨
 *   04/09  UrbanSoccer Aubervilliers left 44 min before kickoff  🟥 → banned
 *
 * Two of those three games never went ahead.
 *
 * He had already appealed on 25/08 and Tim granted it, which is where the first
 * card went. So this is his SECOND reinstatement, not his first, and it is the
 * last one.
 *
 * THE COUNTER IS THE POINT
 *
 * removeCard() decrements by one and clears the ban. That would leave him on 1
 * standing card, so the very next late leave would card him to red and ban him
 * again on the spot. That is not a chance, it is a tripwire.
 *
 * So the counter is explicitly cleared to 0 and every standing card doc is
 * marked removed. He restarts genuinely blank, which is what he is being told
 * in writing.
 *
 * WHAT THIS DOES NOT DO
 *
 * It sends no email. Tim writes that himself.
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
const UID = "Km0imfrnz8gFFIbUZnCBq6y400h1";
const BY = "timothe";

const fr = (d) =>
    d ? new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" }).format(d) : "-";

(async () => {
    const userRef = db.collection("users").doc(UID);
    const snap = await userRef.get();
    if (!snap.exists) throw new Error("no such user");

    const d = snap.data();
    const disc = d.discipline || {};
    console.log(`user:     ${d.display_name} (${d.email})`);
    console.log(`banned:   ${d.banned}`);
    console.log(`cards:    ${disc.cards || 0}`);
    console.log(`positive: ${(d.positive_reports || []).length} · rude: ${(d.rude_reports || []).length}`);

    const cards = await userRef.collection("discipline_cards").get();
    const standing = cards.docs.filter((c) => !c.get("removed_at"));
    console.log(`\ndiscipline_cards: ${cards.size} total, ${standing.length} standing`);
    for (const c of cards.docs) {
        const rm = c.get("removed_at") ? ` REMOVED ${fr(c.get("removed_at").toDate())}` : " STANDING";
        console.log(`  ${c.get("colour").padEnd(6)} ${fr(c.get("issued_at")?.toDate())} ${c.get("game_centre") || "-"}${rm}`);
    }

    const appeals = await db.collection("appeals").where("user", "==", userRef).get();
    const live = appeals.docs.filter((a) => !a.get("superseded_at"));
    console.log(`\nappeals: ${appeals.size} total, ${live.length} still standing`);

    console.log(`\n--- PLAN ---`);
    console.log(`  banned            true -> false`);
    console.log(`  discipline.cards  ${disc.cards || 0} -> 0   (a clean slate, not a tripwire)`);
    console.log(`  cards marked removed: ${standing.length}`);
    console.log(`  appeals superseded:   ${live.length}   (so he can contest a future ban)`);
    console.log(`  push "access restored": yes`);

    if (!WRITE) {
        console.log(`\nDRY RUN. Re-run with --write to apply.`);
        process.exit(0);
    }

    // Counter to zero, not decremented: see the header.
    await userRef.update({
        banned: false,
        "discipline.cards": 0,
        "discipline.last_removed_at": admin.firestore.FieldValue.serverTimestamp(),
        "discipline.last_removed_by": BY,
    });
    console.log(`\nbanned=false, cards=0`);

    // Mark rather than delete: a removed card must vanish from the profile but
    // stay auditable.
    for (const c of standing) {
        await c.ref.update({
            removed_at: admin.firestore.FieldValue.serverTimestamp(),
            removed_by: BY,
        });
    }
    console.log(`marked ${standing.length} card(s) removed`);

    // Retire the appeal along with the ban it contested, so a future ban leaves
    // him able to write to us. This is the bug that produced his support email.
    for (const a of live) {
        await a.ref.update({
            superseded_at: admin.firestore.FieldValue.serverTimestamp(),
            superseded_by: "unban_2026-09-10",
        });
    }
    console.log(`superseded ${live.length} appeal(s)`);

    // Same notification the Slack button sends. NO `sender`: translateAndSendPush
    // strips the sender from the recipient list, so a self-addressed push with
    // sender set is silently dropped.
    await db.collection("connect").add({
        type: "access_restored",
        recipient: [userRef],
        user: userRef,
        game: null,
        source: "unban_appeal",
        status: "published",
        datetime: admin.firestore.FieldValue.serverTimestamp(),
        destination: "https://poteau.app",
        picture: "",
        hash_pic: "",
        sport: "soccer",
    });
    console.log(`queued "access restored" push`);

    const after = await userRef.get();
    console.log(`\nVERIFY banned=${after.get("banned")} cards=${after.get("discipline")?.cards}`);
    process.exit(0);
})().catch((e) => {
    console.error("ERR", e);
    process.exit(1);
});
