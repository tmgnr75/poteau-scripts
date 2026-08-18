const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

// May 8 Foot Power 5 games of interest (the two 17:30 = "19h30 local" candidates + the played ones around it)
const GAME_IDS = [
    'zjqYvBvLH1GO0s23H9R1', // 17:30 published, 0 attendees -> the abandoned/empty one (complaint?)
    '8YnScaKfP1lOTACCbvoe', // 17:30 played, 10 attendees
    'lwV8qGOE7rAYT0gkwMIE', // 16:00 played, created 2026-05-03 (recent)
    'jc3UR0DSU2aP1cDmYwEl', // 16:00 played
];

async function dumpGame(id) {
    const g = await db.collection('games').doc(id).get();
    if (!g.exists) { console.log(`game ${id} MISSING`); return; }
    const d = g.data();
    console.log(`\n========================= GAME ${id} =========================`);
    console.log(`date=${ts(d.date)} end=${ts(d.end_time)} status=${d.status} maxP=${d.max_players} price=${d.price} organizer=${d.organizer} centre=${d.centre}`);
    console.log(`address=${d.address}`);
    console.log(`created_on=${ts(d.created_on)} payment_type=${d.payment_type}`);

    const att = (d.attendees || []);
    console.log(`\nATTENDEES (${att.length}):`);
    for (const a of att) {
        const ref = a?.path ? a : null;
        if (!ref) { console.log('  (non-ref):', a); continue; }
        try {
            const ud = await ref.get();
            const u = ud.data() || {};
            console.log(`  ${ud.id} | ${u.display_name} | ${u.phone_number} | created=${ts(u.created_time)}`);
        } catch (e) { console.log('  err', ref.path); }
    }

    const outs = (d.outsiders || []);
    console.log(`\nOUTSIDERS refs: ${outs.length}`);

    // Teams / spots if present
    if (d.teams) {
        console.log('\nTEAMS/SPOTS:');
        d.teams.forEach((sp, i) => console.log(`  spot[${i}] status=${sp.status} user=${sp.user?.path || sp.user || ''} name=${sp.name||''} plusOne=${sp.plus_one||sp.plusOne||''}`));
    }

    // Chat messages
    console.log('\nCHAT MESSAGES:');
    const msgs = await db.collection('messages').where('game_id', '==', g.ref).get();
    const rows = [];
    msgs.forEach(m => { const md = m.data(); rows.push({ created: ts(md.created), author: md.author_name, type: md.type, trigger: md.trigger, text: md.text }); });
    rows.sort((a,b)=>(a.created||'').localeCompare(b.created||''));
    rows.forEach(r => console.log(`  [${r.created}] (${r.type}${r.trigger?'/'+r.trigger:''}) ${r.author}: ${r.text||''}`));
}

async function main() {
    for (const id of GAME_IDS) await dumpGame(id);
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
