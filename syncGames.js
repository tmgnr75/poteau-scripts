/**
 * syncGames.js
 *
 * Script to reconcile attendees and teams for all future games in Firestore.
 * - Prints current attendees and teams for each game.
 * - Shows diffs with potential updates.
 * - Prompts user to apply updates.
 */

const admin = require('firebase-admin');
const path = require("path");
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});
const db = admin.firestore();

// Import helpers from updateTeamsAttendees.js
const {
    placeAttendeeInTeams,
    getPreferredSlots,
} = require("../poteau_firebase/functions/gen2/updateTeamsAttendees.js");

function extractConfirmedUserIds(teams) {
    const userIds = [];
    for (const spot of teams) {
        if ((spot.status === "confirmed" || spot.status === "reserved") && spot.user_id) {
            userIds.push(spot.user_id);
        }
    }
    return userIds;
}

function showTeams(teams) {
    if (!Array.isArray(teams)) return [];
    return teams.map(s =>
        `#${s.spot_number} ${s.status}` +
        (s.user_id
            ? ` (${s.user_id}${s.plus_one ? ",+1" : ""}${s.plus_one ? ",pos:none" : (s.position ? ",pos:" + s.position : "")})`
            : "")
    );
}

function showAttendees(attendees) {
    if (!Array.isArray(attendees)) return [];
    return attendees.map(ref => ref.id);
}

function diffArrays(oldArr, newArr, label) {
    // Simple diff: show lines added/removed, ignoring order
    const oldSet = new Set(oldArr);
    const newSet = new Set(newArr);
    const removed = [...oldSet].filter(x => !newSet.has(x));
    const added = [...newSet].filter(x => !oldSet.has(x));
    if (removed.length === 0 && added.length === 0) return;
    if (removed.length > 0) console.log(`  - ${label} removed: ${removed.join(", ")}`);
    if (added.length > 0) console.log(`  + ${label} added:   ${added.join(", ")}`);
}

function diffTeams(oldTeams, newTeams) {
    // Show diffs by spot_number
    const maxLen = Math.max(oldTeams.length, newTeams.length);
    for (let i = 0; i < maxLen; ++i) {
        const oldSpot = oldTeams[i];
        const newSpot = newTeams[i];
        if (!oldSpot && newSpot) {
            console.log(`  + spot #${newSpot.spot_number}: ${JSON.stringify(newSpot)}`);
        } else if (oldSpot && !newSpot) {
            console.log(`  - spot #${oldSpot.spot_number}: ${JSON.stringify(oldSpot)}`);
        } else if (JSON.stringify(oldSpot) !== JSON.stringify(newSpot)) {
            console.log(`  * spot #${i}:`);
            console.log(`      before: ${JSON.stringify(oldSpot)}`);
            console.log(`      after:  ${JSON.stringify(newSpot)}`);
        }
    }
}

async function promptYesNo(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase() === "y");
        });
    });
}

async function main() {
    const now = new Date();
    console.log(`[START] Syncing games... (${now.toISOString()})`);
    const gamesSnap = await db.collection("games")
        .where("date", ">", now)
        .where("status", "==", "published")
        .orderBy("date")
        .get();

    if (gamesSnap.empty) {
        console.log("No future games found.");
        console.log("[END] Script completed");
        return;
    }
    console.log(`[INFO] Found ${gamesSnap.docs.length} future games.`);

    for (const doc of gamesSnap.docs) {
        const gameId = doc.id;
        const game = doc.data();
        const attendees = Array.isArray(game.attendees) ? game.attendees : [];
        const teams = Array.isArray(game.teams) ? game.teams : [];
        const game_date = game.game_date ? (game.game_date.toDate ? game.game_date.toDate().toISOString() : game.game_date) : "?";

        console.log(`\n[PROCESS] Game ${gameId} on ${game_date}`);
        console.log(`=== Game: ${gameId} (${game.sport || "sport?"} on ${game_date}) ===`);
        console.log(`Attendees [${attendees.length}]:`, showAttendees(attendees));
        console.log(`Teams [${teams.length}]:`);
        showTeams(teams).forEach(line => console.log("  " + line));

        // Reconciliation logic (mimic updateTeamsAttendees)
        const attendeeUserIds = attendees.map(ref => ref.id).sort();
        const teamUserIds = extractConfirmedUserIds(teams).sort();
        const attendeesTeamsInSync = JSON.stringify(attendeeUserIds) === JSON.stringify(teamUserIds);

        let updateAttendees = null;
        let updateTeams = null;
        let newTeams = teams;
        let newAttendees = attendees;
        let preferredSlots = getPreferredSlots(game);
        let needUpdate = false;

        if (!attendeesTeamsInSync) {
            // Try to reconcile both ways; prefer attendees as source of truth
            // 1. If attendees changed, update teams
            newTeams = placeAttendeeInTeams(teams, attendees, preferredSlots, gameId);
            const newTeamUserIds = extractConfirmedUserIds(newTeams).sort();
            if (JSON.stringify(newTeamUserIds) !== JSON.stringify(attendeeUserIds)) {
                // If still not in sync, update attendees from teams
                // (e.g. if teams changed, but not attendees)
                // Extract user_ids from confirmed/reserved spots
                const updatedAttendees = [];
                for (const spot of newTeams) {
                    if ((spot.status === "confirmed" || spot.status === "reserved") && spot.user_id) {
                        updatedAttendees.push({ id: spot.user_id });
                    }
                }
                newAttendees = updatedAttendees;
                updateAttendees = newAttendees;
            }
            if (JSON.stringify(teams) !== JSON.stringify(newTeams)) {
                updateTeams = newTeams;
            }
            if (updateTeams || updateAttendees) needUpdate = true;
        }

        if (!needUpdate) {
            console.log("Already in sync. No update needed.");
            continue;
        }

        // Show diffs
        if (updateTeams || updateAttendees) {
            console.log(`[CHECK] Differences detected for ${gameId}`);
        }
        if (updateTeams) {
            console.log("\n--- Teams diff ---");
            diffTeams(teams, updateTeams);
        }
        if (updateAttendees) {
            console.log("\n--- Attendees diff ---");
            diffArrays(showAttendees(attendees), showAttendees(updateAttendees), "attendee");
        }

        // Ask user
        console.log(`[PROMPT] Ask user to apply updates for ${gameId}`);
        const apply = await promptYesNo("Apply updates? (y/n) ");
        if (!apply) {
            console.log("Skipped.");
            continue;
        }
        // Apply updates
        const updates = {};
        if (updateTeams) updates.teams = updateTeams;
        if (updateAttendees) updates.attendees = updateAttendees;
        await db.collection("games").doc(gameId).update(updates);
        console.log(`[APPLY] Updates applied for ${gameId}`);
    }
    console.log("[END] Script completed");
}

main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error("Error:", err);
    process.exit(1);
});