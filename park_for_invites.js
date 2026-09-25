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

// SCREEN 2 NEEDS A THIRD STATE, not the two this script started with.
//
// Restoring for screen 2 put the Live fixture back on the viewer, so the games
// list was headed by a black "Your game / 3pm / FULL" card that ate the top
// third of the frame (2026-09-25). Screen 2 is selling the LIST -- free and
// paid games at 6pm through 9:30pm -- and a full game the viewer is already on
// is the one thing on it they cannot act on.
//
// --list therefore detaches the viewer exactly as the invitations state does,
// while leaving the eight list_* fixtures at their evening slots.
const LIST = process.argv.includes("--list");

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
            // ROUND KICKOFFS ONLY (Tim: "never 11:27 like you did").
            //
            // The old fallback was `now - 20 minutes`, which lands on whatever
            // minute the script happened to run at and printed "Today at
            // 3:07pm" on the card. Step back to the previous :00 or :30 that
            // is at least 15 minutes old instead, so the hour is always round
            // and the match clock still reads 15-45 minutes.
            // The slot must be 15-30 minutes old: Home only lists a game that
            // kicked off within the last 30 minutes, and a match clock under
            // 15 minutes reads as "just started" rather than mid-game.
            //
            // Rounding strictly BACKWARDS fights that window -- at 16:08 the
            // previous :30 is 15:30, already 38 minutes old, so the Live card
            // had disappeared from Home by the time it was shot. When no round
            // slot fits, an unrounded 20 minutes ago is better than a rounded
            // kickoff the app will not display.
            let k = new Date(half);
            while ((now - k) / MIN < 15) k = new Date(k.getTime() - 30 * MIN);
            if ((now - k) / MIN > 28) {
                k = new Date(now.getTime() - 20 * MIN);
                k.setSeconds(0, 0);
            }

            // The two fixtures are not the same game and must not share a slot.
            //
            // live_soccer is IN PROGRESS: it kicks off ~20 minutes ago so the
            // match clock reads a believable 20-something minutes.
            //
            // share_played is FINISHED: it kicks off 90 minutes ago and runs a
            // full hour, so the wrap-up card follows a game that has actually
            // ended. It used to be given a 20-MINUTE end_time, which printed
            // "20MIN" on the share card -- no five-a-side lasts 20 minutes
            // (2026-09-25).
            const played = n === "share_played";
            if (played) {
                k = new Date(now.getTime() - 90 * MIN);
                k.setSeconds(0, 0);
                k.setMinutes(k.getMinutes() < 30 ? 0 : 30);
            }
            const mins = g.duration || 60;
            await d.ref.update({
                date: Timestamp.fromDate(k),
                end_time: Timestamp.fromDate(new Date(k.getTime() + mins * MIN)),
                duration: mins,
                poteau_live: true,
                live_teams_confirmed_at: Timestamp.fromDate(new Date(k.getTime() - 5 * MIN)),
                live_opened_at: Timestamp.fromDate(new Date(k.getTime() - 5 * MIN)),
            });
        }
        // Bring the games-list fixtures back to their evening slots.
        for (const d of games.docs) {
            const g = d.data();
            if (!g.store_shelved_from) continue;
            const k = g.store_shelved_from.toDate();
            await d.ref.update({
                date: g.store_shelved_from,
                end_time: Timestamp.fromDate(new Date(k.getTime() + g.duration * MIN)),
                store_shelved_from: admin.firestore.FieldValue.delete(),
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
        // The wrap-up card renders from `pending_feedback`, which the park
        // step clears. Without this, screen 5 has no entry point on Home and
        // the share card cannot be reached at all.
        const playedRef = after.docs.find(
            (d) => d.data().reservation_name === "share_played");
        await anchor.ref.update({
            games: mine,
            pending_feedback: playedRef ? [playedRef.ref] : [],
        });
        console.log(`restored: ${mine.length} game(s) back on the viewer` +
            (playedRef ? ", wrap-up card armed" : ""));
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

    // PARK THE GAMES-LIST FIXTURES TOO.
    //
    // The invitations section does NOT read game_invitations. It renders every
    // nearby joinable game the viewer is not already on, so the eight
    // list_* fixtures seeded for screen 2 appeared on screen 1 as well: the
    // first capture showed six cards spanning 7:30pm to 9:30pm instead of the
    // four prime-time ones the brief asks for, with Brooklyn Bridge Pier 5
    // listed twice.
    //
    // They are moved a week out, which keeps them off Home's horizon while
    // leaving screen 2 free to move them back. Screen 2 is captured after a
    // --restore, so the two screens never need the same state at once.
    let shelved = 0;
    for (const d of games.docs) {
        const g = d.data();
        if (LIST) break;                 // screen 2 wants these visible
        if (!/^list_/.test(g.reservation_name || "")) continue;
        const k = new Date(g.date.toDate().getTime() + 7 * 24 * 60 * MIN);
        await d.ref.update({
            date: Timestamp.fromDate(k),
            end_time: Timestamp.fromDate(new Date(k.getTime() + g.duration * MIN)),
            store_shelved_from: g.date,
        });
        shelved += 1;
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
    console.log(`  shelved ${shelved} games-list fixture(s) a week out`);
    console.log(`parked ${parked} fixture(s); viewer detached from all games`);
    process.exit(0);
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
