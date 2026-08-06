/**
 * Restore Kevin Lumpini into the PAST games he was wrongly removed from.
 *
 * Context
 * -------
 * On 2026-08-04 11:19:47 UTC Kevin (3MlTRWKO6SSzIyoy3qDDTONz6th2) was banned.
 * The `updateUserBannedStatus` trigger (index.js ~3713) reacts to banned
 * false->true and strips the user from every game returned by:
 *
 *     games.where('interested', array-contains, userRef)
 *     games.where('attendees',  array-contains, userRef)
 *
 * Those queries have NO date and NO status filter, so past games are stripped
 * exactly like future ones. 351 games were rewritten in one batch. He has since
 * been unbanned, but the removals were never reversed.
 *
 * What this restores, and what it deliberately does not
 * ----------------------------------------------------
 * The trigger writes BOTH arrays back on every touched game, so the log line
 * alone cannot tell you which array he was actually in. Restoring all 351 into
 * `attendees` would invent roster history. So the safe signal is used instead:
 *
 *   - `users.played_games` still lists his 9 real past games. That array was
 *     NOT touched by the trigger, which is why it survived. Those 9 are the
 *     only games where he was provably an attendee.
 *   - The other 342 are `interested`-only (or already restored). `interested`
 *     is a soft signal with no roster or history meaning, and re-adding him to
 *     342 old games' `interested` would resurrect stale rows for no user-visible
 *     gain. They are reported, not written.
 *
 * The freed spot
 * --------------
 * `teams` is a FIXED-LENGTH array of spots (length == max_players). Removing a
 * player does not delete their entry, it flips it to {status:'open'}. On all 9
 * games teams.length is still 10 and there is at least one open spot. Restoring
 * therefore CLAIMS an open spot rather than appending one, which keeps
 * teams.length == max_players. Appending would over-fill the game.
 *
 * Drift
 * -----
 * Some games changed after the removal (other players left). Current state is
 * always re-read inside the transaction; the 2026-08-04 log is used only to
 * decide WHICH games he belongs in, never to overwrite the present roster.
 *
 * Usage:
 *   node restore_kevin_past_games.js --dry     (default, writes nothing)
 *   node restore_kevin_past_games.js --apply
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});
const db = admin.firestore();

const UID = '3MlTRWKO6SSzIyoy3qDDTONz6th2';
const APPLY = process.argv.includes('--apply');

async function main() {
    const mode = APPLY ? 'APPLY' : 'DRY RUN';
    console.log(`[${mode}] Restoring ${UID} into wrongly-removed past games\n`);

    const userRef = db.collection('users').doc(UID);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error('User not found');

    const userData = userSnap.data();
    if (userData.banned === true) {
        // Restoring while banned would immediately re-trigger the very function
        // that caused this, undoing every write below.
        throw new Error('User is still banned. Unban first, or the trigger will strip them again.');
    }

    const playedIds = (userData.played_games || []).map((r) => r.id);
    console.log(`played_games lists ${playedIds.length} past games.\n`);

    let restored = 0;
    let skipped = 0;

    for (const gameId of playedIds) {
        const gameRef = db.collection('games').doc(gameId);

        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(gameRef);
            if (!snap.exists) return { action: 'missing' };

            const game = snap.data();
            const attendees = game.attendees || [];
            const teams = game.teams || [];

            const alreadyIn = attendees.some((r) => r.id === UID);
            const inTeams = teams.some((t) => t.user_id === UID);
            if (alreadyIn && inTeams) return { action: 'already-restored' };

            const update = {};

            if (!alreadyIn) update.attendees = [...attendees, userRef];

            if (!inTeams) {
                // Claim the first open spot rather than appending, so
                // teams.length stays equal to max_players.
                const idx = teams.findIndex((t) => t && t.status === 'open');
                if (idx === -1) return { action: 'no-open-spot', attendeesLen: attendees.length };

                const spot = teams[idx];
                const newTeams = [...teams];
                newTeams[idx] = {
                    ...spot,
                    status: 'confirmed',
                    user_id: UID,
                    plus_one: false,
                };
                update.teams = newTeams;
            }

            if (APPLY) tx.update(gameRef, update);

            return {
                action: 'restore',
                date: game.date && game.date.toDate ? game.date.toDate().toISOString().slice(0, 16) : '?',
                status: game.status,
                centre: game.centre || game.reservation_name || '?',
                addedToAttendees: !alreadyIn,
                claimedSpot: !inTeams,
            };
        });

        if (result.action === 'restore') {
            restored++;
            console.log(
                `  ${APPLY ? 'RESTORED' : 'WOULD RESTORE'} ${gameId} | ${result.date} | ${result.status} | ${result.centre}` +
                ` | attendees:${result.addedToAttendees ? '+1' : 'ok'} spot:${result.claimedSpot ? 'claimed' : 'ok'}`
            );
        } else {
            skipped++;
            console.log(`  SKIP ${gameId} (${result.action})`);
        }
    }

    console.log(`\n[${mode}] restored: ${restored}, skipped: ${skipped}`);
    if (!APPLY) console.log('Nothing was written. Re-run with --apply to commit.');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('FATAL:', err.message);
        process.exit(1);
    });
