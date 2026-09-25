/**
 * Reset the played fixture's live_events to exactly the seeded scoreline.
 *
 * The wrap-up flow's goals step APPENDS a real attribution event every time
 * the walk passes through it, so a second capture of screen 5 renders
 * "2 GOALS SCORED" where the brief asks for one. This rewrites the subcollection
 * from scratch, and must run before each screen-5 capture.
 */
const admin = require("firebase-admin");
admin.initializeApp({
    credential: admin.credential.cert(require("/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json")),
    projectId: "krank-club",
});
const db = admin.firestore();
const { Timestamp } = admin.firestore;
const MIN = 60000;

(async () => {
    const anchor = (await db.collection("users")
        .where("store_anchor", "==", true).limit(1).get()).docs[0];
    const games = await db.collection("games")
        .where("seed_tag", "==", "store_shots_520").get();
    const sp = games.docs.find(d => d.data().reservation_name === "share_played");
    if (!sp) { console.log("no share_played fixture"); process.exit(0); }

    const g = sp.data();
    const old = await sp.ref.collection("live_events").get();
    for (const d of old.docs) await d.ref.delete();

    const roster = (g.teams || []).map(t => t.user_id).filter(Boolean);
    const A = roster.filter((_, i) => i % 2 === 0);
    const B = roster.filter((_, i) => i % 2 === 1);
    const base = g.date.toDate();
    const out = [];
    const mk = (scorer, side, min) => {
        const at = new Date(base.getTime() + min * MIN);
        const cid = `seed_store_shots_520_wrap_${side}_${min}`;
        out.push({ type: "point", side, created_by: scorer,
            created_at: Timestamp.fromDate(at), client_at: Timestamp.fromDate(at),
            client_event_id: cid });
        out.push({ type: "attribution", attributes: cid, scorer_id: scorer,
            created_by: scorer,
            created_at: Timestamp.fromDate(new Date(at.getTime() + 3000)),
            client_at: Timestamp.fromDate(new Date(at.getTime() + 3000)),
            client_event_id: `${cid}_attr` });
    };
    let m = 3;
    // 3-2, and the viewer scores exactly ONE of the three.
    for (let i = 0; i < 3; i++) { mk(i < 1 ? anchor.id : A[i % A.length], "team_a", m); m += 3; }
    for (let i = 0; i < 2; i++) { mk(B[i % B.length], "team_b", m); m += 3; }
    for (const e of out) await sp.ref.collection("live_events").add(e);

    console.log(`reset: 3-2, viewer scores 1 (${out.length} events)`);
    process.exit(0);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
