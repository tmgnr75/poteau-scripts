const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// DRY_RUN unless EXECUTE=1
const DRY_RUN = process.env.EXECUTE !== '1';

const ZAMUEL_UID = 'fQCEL4nvfxQ6N7na61ARPt4wDCl1';
const RESERVATION_NAME = 'Soctainer x Poteau Tournament';
const NEW_MAX_PLAYERS = 30;

// First published (created_on 2026-06-05T13:50:43) -> keep
const KEEPER = '0ksCjVGqhB5uNc6ZO6Du';
// The 5 others -> canceled
const TO_CANCEL = ['D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];

// Build N open spots, first half team_a, second half team_b — mirrors the CF's buildOpenSpots()
// so the doc is correct even if the updateTeamsAttendees trigger is disabled.
function buildOpenSpots(maxPlayers) {
    const half = Math.floor(maxPlayers / 2);
    return Array.from({ length: maxPlayers }, (_, i) => ({
        status: 'open',
        team_side: i < half ? 'team_a' : 'team_b',
    }));
}

async function main() {
    console.log(DRY_RUN ? '======= DRY RUN (no writes) =======\n' : '======= EXECUTING (writing changes) =======\n');

    // Sanity: Zamuel exists
    const zSnap = await db.collection('users').doc(ZAMUEL_UID).get();
    if (!zSnap.exists) { console.error(`!! Zamuel ${ZAMUEL_UID} not found — aborting.`); process.exit(1); }
    console.log(`Zamuel: ${zSnap.get('display_name')} (${ZAMUEL_UID})\n`);

    // 1) Cancel the 5 other games
    for (const gid of TO_CANCEL) {
        const ref = db.collection('games').doc(gid);
        const snap = await ref.get();
        if (!snap.exists) { console.log(`!! ${gid} MISSING — skip`); continue; }
        const d = snap.data();
        console.log(`CANCEL ${gid}: status ${d.status} -> canceled | attendees=${(d.attendees||[]).length} interested=${(d.interested||[]).length}`);
        if (!DRY_RUN) {
            await ref.update({ status: 'canceled' });
            console.log(`   written.`);
        }
    }

    // 2) Fix the keeper
    const kRef = db.collection('games').doc(KEEPER);
    const kSnap = await kRef.get();
    if (!kSnap.exists) { console.error(`!! KEEPER ${KEEPER} MISSING — aborting.`); process.exit(1); }
    const k = kSnap.data();
    const newTeams = buildOpenSpots(NEW_MAX_PLAYERS);

    console.log(`\nKEEPER ${KEEPER}:`);
    console.log(`   organizer:        ${k.organizer}  ->  ${ZAMUEL_UID}`);
    console.log(`   attendees:        [${(k.attendees||[]).map(r=>r.id||r).join(', ')}]  ->  []`);
    console.log(`   max_players:      ${k.max_players}  ->  ${NEW_MAX_PLAYERS}`);
    console.log(`   players_to_find:  ${k.players_to_find}  ->  ${NEW_MAX_PLAYERS}`);
    console.log(`   reservation_name: "${k.reservation_name}"  ->  "${RESERVATION_NAME}"`);
    console.log(`   teams:            ${(k.teams||[]).length} spots  ->  ${newTeams.length} open spots (${newTeams.filter(t=>t.team_side==='team_a').length} A / ${newTeams.filter(t=>t.team_side==='team_b').length} B)`);

    if (!DRY_RUN) {
        // Single update. The updateTeamsAttendees CF will fire: afterAttendees.length === 0 (CASE 1)
        // -> it resets teams to buildOpenSpots(after.max_players) = 30 open spots, matching newTeams.
        // We also write teams + players_to_find ourselves so the doc is correct regardless of the CF.
        await kRef.update({
            organizer: ZAMUEL_UID,
            attendees: [],
            max_players: NEW_MAX_PLAYERS,
            players_to_find: NEW_MAX_PLAYERS,
            reservation_name: RESERVATION_NAME,
            teams: newTeams,
        });
        console.log(`   written.`);
    }

    console.log(DRY_RUN ? '\nDRY RUN complete. Re-run with EXECUTE=1 to write.' : '\nDone. Verify the keeper after the CF settles.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
