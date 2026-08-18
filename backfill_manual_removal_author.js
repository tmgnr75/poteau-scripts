/**
 * Backfill: manual_removal chat logs credited to the removed player.
 *
 * `gen2/removePlayer.js` wrote author_id/author_name/author_picture from the
 * REMOVED player's uid instead of the captain who pressed the button. Because
 * translateLogs renders "a retiré {user.display_name}" and the app renders the
 * header name, avatar, Gold badge and profile tap target from author_id, the
 * line read "Mohamed a retiré Mohamed" and tapping it opened the wrong profile.
 *
 * Regression window: commit 2186739 (2025-12-03) -> the forward fix.
 * Measured 2026-08-18: 1,059 of 1,426 manual_removal logs affected.
 *
 * The captain is recovered from `games.organizer` (a plain UID string).
 *
 * A row is rewritten ONLY when all of these hold:
 *   - trigger == "manual_removal"
 *   - author_id == user  (both name the removed player -> the bug signature)
 *   - the game exists and has an organizer
 *   - that organizer is NOT the removed player
 *
 * The last test matters: a captain can remove their own +1, and then author ==
 * user == organizer is CORRECT and must be left alone.
 *
 * Dry by default. Pass --write to commit.
 */

const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

(async () => {
    console.log(WRITE ? '=== WRITE MODE ===' : '=== DRY RUN (pass --write to commit) ===');

    const snap = await db.collection('messages').where('trigger', '==', 'manual_removal').get();
    console.log(`manual_removal messages: ${snap.size}`);

    // Only the rows carrying the bug signature.
    const candidates = snap.docs.filter((d) => {
        const m = d.data();
        return m.user && m.author_id && m.user.id === m.author_id.id;
    });
    console.log(`author == removed player (bug signature): ${candidates.length}`);

    // Resolve each game once.
    const gameIds = [...new Set(candidates.map((d) => d.data().game_id?.id).filter(Boolean))];
    console.log(`distinct games to resolve: ${gameIds.length}`);

    const organizerByGame = {};
    for (let i = 0; i < gameIds.length; i += 300) {
        const chunk = gameIds.slice(i, i + 300);
        const refs = chunk.map((id) => db.collection('games').doc(id));
        const docs = await db.getAll(...refs);
        docs.forEach((g) => { organizerByGame[g.id] = g.exists ? (g.data().organizer || null) : null; });
        process.stdout.write(`\r  resolved ${Math.min(i + 300, gameIds.length)}/${gameIds.length}`);
    }
    console.log('');

    // Resolve each captain once.
    const organizerUids = [...new Set(Object.values(organizerByGame).filter(Boolean))];
    console.log(`distinct organizers to resolve: ${organizerUids.length}`);

    const userByUid = {};
    for (let i = 0; i < organizerUids.length; i += 300) {
        const chunk = organizerUids.slice(i, i + 300);
        const refs = chunk.map((uid) => db.collection('users').doc(uid));
        const docs = await db.getAll(...refs);
        docs.forEach((u) => { userByUid[u.id] = u.exists ? u.data() : null; });
        process.stdout.write(`\r  resolved ${Math.min(i + 300, organizerUids.length)}/${organizerUids.length}`);
    }
    console.log('');

    const plan = [];
    const skipped = { noGame: 0, noOrganizer: 0, organizerIsRemoved: 0, noUserDoc: 0 };

    for (const d of candidates) {
        const m = d.data();
        const gid = m.game_id?.id;
        if (!gid || !(gid in organizerByGame)) { skipped.noGame++; continue; }

        const orgUid = organizerByGame[gid];
        if (!orgUid) { skipped.noOrganizer++; continue; }

        // Captain removing their own +1 -- author == user == organizer is correct.
        if (orgUid === m.user.id) { skipped.organizerIsRemoved++; continue; }

        const org = userByUid[orgUid];
        if (!org) { skipped.noUserDoc++; continue; }

        plan.push({
            ref: d.ref,
            id: d.id,
            before: m.author_name,
            after: org.display_name || '',
            removed: m.text,
            update: {
                author_id: db.collection('users').doc(orgUid),
                author_name: org.display_name || '',
                author_picture: org.photo_url || '',
            },
        });
    }

    console.log(`\nto rewrite: ${plan.length}`);
    console.log('skipped:', JSON.stringify(skipped));
    console.log('\nsample (first 10):');
    plan.slice(0, 10).forEach((p) => {
        console.log(`  ${p.id}  "${p.before}" -> "${p.after}"   [${p.removed}]`);
    });

    if (!WRITE) {
        console.log('\nDry run. Nothing written.');
        return;
    }

    let done = 0;
    for (let i = 0; i < plan.length; i += 400) {
        const batch = db.batch();
        plan.slice(i, i + 400).forEach((p) => batch.update(p.ref, p.update));
        await batch.commit();
        done += Math.min(400, plan.length - i);
        process.stdout.write(`\r  written ${done}/${plan.length}`);
    }
    console.log('\nDone.');
})().catch((e) => { console.error(e); process.exit(1); });
