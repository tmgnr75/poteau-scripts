/**
 * Repair played games left with all-open `teams` by the pre-2026-07-21
 * `lockedUsers` bug in updateTeamsAttendees (CxxjBEed incident).
 *
 * That exclude-list filtered captured-payment users OUT of team rebuilds,
 * leaving the team sheet empty while `attendees` was full. It was removed on
 * 2026-07-21 (commit 5089640). Zero games dated after the fix show the problem;
 * these documents are stranded data, not a live bug.
 *
 * This applies the SAME placement logic updateTeamsAttendees uses today.
 *
 * NOTE: this reconstructs who was ON THE SHEET, not who actually played which
 * side. That information is unrecoverable. These games predate any scoring, so
 * no result depends on it.
 *
 * Usage:
 *   node repair_stranded_teams.js          # dry run, writes nothing
 *   node repair_stranded_teams.js --write  # apply
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

// --- placement logic, mirroring gen2/updateTeamsAttendees.js ---

function buildOpenSpots(maxPlayers) {
    const half = Math.floor(maxPlayers / 2);
    return Array.from({ length: maxPlayers }, (_, i) => ({
        status: 'open',
        team_side: i < half ? 'team_a' : 'team_b',
    }));
}

async function placePlayers(teams, joined, gameId) {
    const newTeams = [...teams];
    const positionByUser = {};

    const uniqueIds = [...new Set(joined.map((j) => j.uid))];
    const userDocs = await Promise.all(
        uniqueIds.map((id) => db.collection('users').doc(id).get())
    );
    userDocs.forEach((doc, idx) => {
        positionByUser[uniqueIds[idx]] = doc.exists ? doc.get('soccer_position') : undefined;
    });

    for (const { uid, count } of joined) {
        for (let k = 0; k < count; k++) {
            const already = newTeams.filter((s) => s.user_id === uid).length;
            const plusOne = already > 0;
            let openIdx = -1;

            // A +1 goes on the same side as its base spot when possible.
            if (plusOne) {
                const base = newTeams.find((s) => s.user_id === uid && !s.plus_one);
                if (base) {
                    openIdx = newTeams.findIndex(
                        (s) => s.status === 'open' && s.team_side === base.team_side
                    );
                }
            }
            if (openIdx === -1) openIdx = newTeams.findIndex((s) => s.status === 'open');

            if (openIdx === -1) {
                console.warn(`  [${gameId}] no open spot left for ${uid}`);
                continue;
            }

            const spot = {
                status: 'confirmed',
                user_id: uid,
                plus_one: plusOne,
                team_side: newTeams[openIdx].team_side,
            };
            if (!plusOne && positionByUser[uid]) spot.position = positionByUser[uid];
            newTeams[openIdx] = spot;
        }
    }
    return newTeams;
}

// --- scan + repair ---

async function findStranded() {
    const stranded = [];
    let last = null;
    let scanned = 0;

    for (;;) {
        let q = db
            .collection('games')
            .where('status', '==', 'played')
            .orderBy('__name__')
            .limit(2000);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;

        snap.forEach((doc) => {
            const g = doc.data();
            scanned++;
            const attendees = (g.attendees || []).filter((r) => r && r.id);
            const occupied = (g.teams || []).filter((t) => t && t.user_id);
            if (attendees.length > 0 && occupied.length === 0) {
                stranded.push({ id: doc.id, ref: doc.ref, data: g });
            }
        });

        last = snap.docs[snap.docs.length - 1].id;
        if (snap.size < 2000) break;
    }
    return { stranded, scanned };
}

(async () => {
    console.log(WRITE ? '*** WRITE MODE ***\n' : '--- DRY RUN (nothing will be written) ---\n');

    const { stranded, scanned } = await findStranded();
    console.log(`Scanned ${scanned} played games — ${stranded.length} stranded.\n`);

    if (stranded.length === 0) {
        console.log('Nothing to repair.');
        process.exit(0);
    }

    let repaired = 0;
    for (const { id, ref, data: g } of stranded) {
        const attendeeIds = (g.attendees || []).filter((r) => r && r.id).map((r) => r.id);
        const maxPlayers = g.max_players || attendeeIds.length;

        const counts = attendeeIds.reduce((m, uid) => ((m[uid] = (m[uid] || 0) + 1), m), {});
        const joined = Object.entries(counts).map(([uid, count]) => ({ uid, count }));

        const teams = await placePlayers(buildOpenSpots(maxPlayers), joined, id);

        const occupied = teams.filter((t) => t.user_id).length;
        const sideA = teams.filter((t) => t.user_id && t.team_side === 'team_a').length;
        const sideB = teams.filter((t) => t.user_id && t.team_side === 'team_b').length;
        const plusOnes = teams.filter((t) => t.plus_one).length;
        const date = g.date && g.date.toDate ? g.date.toDate().toISOString().slice(0, 10) : 'nodate';

        console.log(
            `${id}  ${date}  attendees=${attendeeIds.length} unique=${new Set(attendeeIds).size} ` +
            `max=${maxPlayers} -> occupied=${occupied} (A:${sideA} B:${sideB}) plus_one=${plusOnes}`
        );

        if (occupied !== attendeeIds.length) {
            console.warn('   SKIPPED: placed count does not match attendees — inspect manually');
            continue;
        }

        if (WRITE) {
            await ref.update({ teams });
            console.log('   written');
            repaired++;
        }
    }

    console.log(
        WRITE
            ? `\nDone. ${repaired}/${stranded.length} repaired.`
            : `\nDry run complete. Re-run with --write to apply.`
    );
    process.exit(0);
})().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
});
