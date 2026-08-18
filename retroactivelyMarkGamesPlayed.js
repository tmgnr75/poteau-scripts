/**
 * retroactivelyMarkGamesPlayed.js
 *
 * Takes one or more game IDs and retroactively marks them as played.
 * It fills only the MISSING spots in `attendees` and `teams` with the
 * organizer's user ref, preserving any real players already registered.
 * Then replicates the exact side-effects of the `gameStatusUpdater` Cloud Function:
 *   - Sets game `status` → "played"
 *   - Updates each attendee's: pending_feedback, played_games,
 *     last_organized_date / last_played_date
 *   - Sends an Amplitude "Played" event with the game's original start time
 *     (not the script execution time)
 *
 * Usage:
 *   node retroactivelyMarkGamesPlayed.js <gameId1> [gameId2 ...]
 *
 * Example:
 *   node retroactivelyMarkGamesPlayed.js abc123 def456
 */

const admin = require('firebase-admin');
const amplitude = require('@amplitude/analytics-node');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

amplitude.init('57f03efbb1dfde7b97bb291b7eafa32f');

const db = admin.firestore();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fill only the open (empty) spots in the existing `teams` array with the
 * organizer. Confirmed/reserved spots belonging to real players are untouched.
 */
async function fillTeams(existingTeams, organizerId, sport) {
    // Fetch organizer position for soccer
    let organizerPosition;
    if (sport === 'soccer') {
        const snap = await db.collection('users').doc(organizerId).get();
        if (snap.exists) {
            const data = snap.data();
            if (typeof data.soccer_position === 'string' && data.soccer_position.length > 0) {
                organizerPosition = data.soccer_position;
            }
        }
    }

    // Is this the first time the organizer appears in the teams array?
    const organizerAlreadyInTeams = existingTeams.some(
        (s) => (s.status === 'confirmed' || s.status === 'reserved') && s.user_id === organizerId
    );
    let isFirstOrganizerOccurrence = !organizerAlreadyInTeams;

    return existingTeams.map((spot) => {
        if (spot.status !== 'open') {
            return spot; // real player — leave untouched
        }

        const filled = {
            team_side: spot.team_side,
            status: 'confirmed',
            user_id: organizerId,
            plus_one: !isFirstOrganizerOccurrence,
        };

        if (isFirstOrganizerOccurrence && organizerPosition) {
            filled.position = organizerPosition;
        }

        isFirstOrganizerOccurrence = false;
        return filled;
    });
}

/**
 * Pad the existing `attendees` array up to `maxPlayers` with the organizer ref.
 * Real attendees already in the array are untouched.
 */
function fillAttendees(existingAttendees, maxPlayers, organizerId) {
    const organizerRef = db.collection('users').doc(organizerId);
    const missing = maxPlayers - existingAttendees.length;
    if (missing <= 0) return existingAttendees;
    return [...existingAttendees, ...Array(missing).fill(organizerRef)];
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

async function processGame(gameId) {
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
        console.error(`[${gameId}] Game not found — skipping.`);
        return;
    }

    const gameData = gameDoc.data();
    const { organizer, max_players, sport, type, currency, date } = gameData;

    if (!organizer) {
        console.error(`[${gameId}] Game has no organizer field — skipping.`);
        return;
    }

    const maxPlayers = max_players || 10;
    const sportVal = sport || 'soccer';
    const existingAttendees = gameData.attendees || [];
    const existingTeams = gameData.teams || [];

    console.log(`[${gameId}] Processing game — organizer: ${organizer}, max_players: ${maxPlayers}, sport: ${sportVal}, existing attendees: ${existingAttendees.length}`);

    // 1. Fill only the gaps — keep real players intact
    const attendees = fillAttendees(existingAttendees, maxPlayers, organizer);
    const teams = await fillTeams(existingTeams, organizer, sportVal);

    const filledAttendeeSlots = attendees.length - existingAttendees.length;
    const filledTeamSlots = teams.filter((s) => s.user_id === organizer).length
        - existingTeams.filter((s) => s.user_id === organizer).length;

    console.log(`[${gameId}] Filling ${filledAttendeeSlots} attendee slot(s) and ${filledTeamSlots} team slot(s) with organizer.`);

    // 2. Update the game document
    await gameRef.update({
        attendees,
        teams,
        status: 'played',
    });

    console.log(`[${gameId}] Game updated: status=played.`);

    // 3. Replicate gameStatusUpdater side-effects for each unique attendee
    //    (real players + organizer fill-ins).
    const uniqueAttendees = [...new Set(attendees.map((ref) => ref.id))];

    for (const attendeeId of uniqueAttendees) {
        const attendeeRef = db.collection('users').doc(attendeeId);
        const attendeeDoc = await attendeeRef.get();
        const attendeeData = attendeeDoc.exists ? attendeeDoc.data() : {};

        const isOrganizer = gameData.organizer === attendeeId;
        const userType = isOrganizer ? 'organizer' : 'player';

        const updateData = {
            pending_feedback: admin.firestore.FieldValue.arrayUnion(gameRef),
        };

        // Only add to played_games if not already there
        if (
            !attendeeData.played_games ||
            !attendeeData.played_games.some((ref) => ref.id === gameId)
        ) {
            updateData.played_games = admin.firestore.FieldValue.arrayUnion(gameRef);
        }

        if (isOrganizer) {
            updateData.last_organized_date = gameData.date;
        } else {
            updateData.last_played_date = gameData.date;
        }

        await attendeeRef.update(updateData);
        console.log(`[${gameId}] Updated user ${attendeeId} (${userType}).`);

        // 4. Send Amplitude "Played" event.
        //    Use the game's own start date as the event timestamp (epoch ms),
        //    not the current time when this script runs.
        //    `time` must be on the event object itself (first arg), not inside eventProperties.
        const gameTimestampMs = date && date.toDate ? date.toDate().getTime() : Date.now();

        amplitude.track({
            event_type: 'Played',
            time: gameTimestampMs,
            user_id: attendeeId,
            device_id: 'backend',
            event_properties: {
                gameId,
                type: type,
                role: userType,
                sport: sportVal || 'none',
                currency: currency || 'none',
            },
        });

        console.log(`[${gameId}] Amplitude "Played" event sent for user ${attendeeId} at ${new Date(gameTimestampMs).toISOString()}.`);
    }

    console.log(`[${gameId}] Done.`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
    const gameIds = process.argv.slice(2);

    if (gameIds.length === 0) {
        console.error('Usage: node retroactivelyMarkGamesPlayed.js <gameId1> [gameId2 ...]');
        process.exit(1);
    }

    console.log(`Processing ${gameIds.length} game(s): ${gameIds.join(', ')}`);

    for (const gameId of gameIds) {
        await processGame(gameId);
    }

    // Flush Amplitude events before exiting
    await amplitude.flush();

    console.log('\nAll games processed.');
    await admin.app().delete();
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
