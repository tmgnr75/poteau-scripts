/**
 * Put the fixtures into the state screen 1 needs: INVITATIONS ONLY.
 *
 * Home renders "Tes matchs" -- Live cards, upcoming games the viewer is on,
 * and the wrap-up card -- ABOVE the invitations. Screen 1 is meant to show
 * invitations and nothing else (Tim, 2026-09-25), so everything that would
 * appear in that section is moved out of Home's 30-minute window and the
 * viewer is detached from the games they are on.
 *
 * `--restore` puts them back for screens 4 and 5.
 */
const admin = require("firebase-admin");
admin.initializeApp({
    credential: admin.credential.cert(require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
    projectId: "krank-club",
});
const db = admin.firestore();
const { Timestamp } = admin.firestore;
const MIN = 60000;
const RESTORE = process.argv.includes("--restore");

(async () => {
    const games = await db.collection("games").where("seed_tag", "==", "store_shots_520").get();
    const anchor = (await db.collection("users").where("store_anchor", "==", true).limit(1).get()).docs[0];

    if (RESTORE) {
        // Live and played come back inside the window, rounded and recent.
        for (const d of games.docs) {
            const g = d.data();
            const n = g.reservation_name;
            if (n !== "live_soccer" && n !== "share_played") continue;
            const now = new Date();
            const half = new Date(now); half.setSeconds(0, 0);
            half.setMinutes(now.getMinutes() < 30 ? 0 : 30);
            const age = (now - half) / MIN;
            const k = (age >= 5 && age <= 25) ? half : new Date(now - 20 * MIN);
            await d.ref.update({
                date: Timestamp.fromDate(k),
                end_time: Timestamp.fromDate(new Date(k.getTime() + (n === "share_played" ? 20 : g.duration) * MIN)),
                poteau_live: true,
                live_teams_confirmed_at: Timestamp.fromDate(new Date(k.getTime() - 5 * MIN)),
                live_opened_at: Timestamp.fromDate(new Date(k.getTime() - 5 * MIN)),
            });
        }
        // Put the viewer back on every roster they were taken off.
        for (const d of games.docs) {
            const g = d.data();
            if (g.store_viewer_was_on !== true) continue;
            const teams = (g.teams || []).slice();
            const slot = teams.findIndex((t) => !t.user_id);
            if (slot >= 0) {
                teams[slot] = { ...teams[slot], user_id: anchor.id, status: "confirmed" };
                await d.ref.update({
                    teams,
                    attendees: [...(g.attendees || []), db.collection("users").doc(anchor.id)],
                    store_viewer_was_on: admin.firestore.FieldValue.delete(),
                });
            }
        }
        const after = await db.collection("games").where("seed_tag", "==", "store_shots_520").get();
        const mine = after.docs
            .filter((d) => (d.data().teams || []).some((t) => t.user_id === anchor.id))
            .map((d) => d.ref);
        await anchor.ref.update({ games: mine });
        console.log(`restored: ${mine.length} game(s) back on the viewer`);
        process.exit(0);
    }

    // Park everything that would fill "Tes matchs".
    let parked = 0;
    for (const d of games.docs) {
        const g = d.data();
        if (!["live_soccer", "share_played"].includes(g.reservation_name)) continue;
        const k = new Date(Date.now() - 300 * MIN);
        await d.ref.update({
            date: Timestamp.fromDate(k),
            end_time: Timestamp.fromDate(new Date(k.getTime() + g.duration * MIN)),
        });
        parked += 1;
    }
    // The viewer must be off every ROSTER, not merely out of users.games.
    //
    // Home queries `attendees arrayContains currentUserReference`, so clearing
    // users.games changes nothing: the card still renders from the roster. The
    // viewer is therefore detached from the teams array and the attendees list
    // of every fixture, and `--restore` puts them back.
    let detached = 0;
    for (const d of games.docs) {
        const g = d.data();
        const teams = g.teams || [];
        if (!teams.some((t) => t.user_id === anchor.id)) continue;
        await d.ref.update({
            teams: teams.map((t) => t.user_id === anchor.id
                ? { ...t, user_id: "", status: "open" } : t),
            attendees: (g.attendees || []).filter((r) => r.id !== anchor.id),
            store_viewer_was_on: true,
        });
        detached += 1;
    }
    await anchor.ref.update({ games: [], pending_feedback: [] });
    console.log(`  detached the viewer from ${detached} roster(s)`);
    console.log(`parked ${parked} fixture(s); viewer detached from all games`);
    process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
