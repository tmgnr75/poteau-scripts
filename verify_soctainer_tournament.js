const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const KEEPER = '0ksCjVGqhB5uNc6ZO6Du';
const TO_CANCEL = ['D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];
const ZAMUEL_UID = 'fQCEL4nvfxQ6N7na61ARPt4wDCl1';

async function main() {
    const k = (await db.collection('games').doc(KEEPER).get()).data();
    const teams = k.teams || [];
    const open = teams.filter(t => t.status === 'open').length;
    const occupied = teams.filter(t => t.status !== 'open');
    const a = teams.filter(t => t.team_side === 'team_a').length;
    const b = teams.filter(t => t.team_side === 'team_b').length;

    console.log('=== KEEPER', KEEPER, '===');
    console.log('status:          ', k.status);
    console.log('organizer:       ', k.organizer, k.organizer === ZAMUEL_UID ? 'OK (Zamuel)' : '!! NOT Zamuel');
    console.log('attendees:       ', (k.attendees||[]).map(r=>r.id||r), (k.attendees||[]).length === 0 ? 'OK (empty)' : '!! NOT empty');
    console.log('max_players:     ', k.max_players, k.max_players === 30 ? 'OK' : '!!');
    console.log('players_to_find: ', k.players_to_find);
    console.log('reservation_name:', JSON.stringify(k.reservation_name));
    console.log(`teams:            ${teams.length} spots | ${open} open | ${occupied.length} occupied | ${a} team_a / ${b} team_b`);
    if (occupied.length) console.log('  !! occupied spots:', JSON.stringify(occupied));
    const teamsOk = teams.length === 30 && open === 30 && a === 15 && b === 15;
    console.log('teams check:     ', teamsOk ? 'OK (30 open, 15/15)' : '!! UNEXPECTED');

    console.log('\n=== Canceled games ===');
    for (const gid of TO_CANCEL) {
        const d = (await db.collection('games').doc(gid).get()).data();
        console.log(`  ${gid}: status=${d.status} ${d.status === 'canceled' ? 'OK' : '!!'}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
