const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
const DANNY_UID = 'ausjLaB8ySbGDRZ5flISejVrjmh2';

function ts(v) { return v && v.toDate ? v.toDate().toISOString() : v; }

async function main() {
    // Danny's games -> find the 9 July ~19:30 Speed Soccer Five game with Adil in attendees
    const danny = await db.collection('users').doc(DANNY_UID).get();
    const gameRefs = danny.data().games || [];
    console.log(`Danny has ${gameRefs.length} game refs.`);

    const games = [];
    for (const gRef of gameRefs) {
        try {
            const g = await gRef.get();
            if (g.exists) games.push({ id: g.id, ref: g.ref, data: g.data() });
        } catch (e) {}
    }
    games.sort((a, b) => {
        const da = a.data.date && a.data.date.toDate ? a.data.date.toDate().getTime() : 0;
        const dbb = b.data.date && b.data.date.toDate ? b.data.date.toDate().getTime() : 0;
        return dbb - da;
    });

    // Show recent games and flag the target
    let target = null;
    for (const g of games.slice(0, 10)) {
        const d = g.data;
        const attIds = (d.attendees || []).map(r => r.id);
        const hasAdil = attIds.includes(ADIL_UID);
        const dateStr = ts(d.date);
        console.log(`\nGame ${g.id} | ${dateStr} | ${d.status} | ${d.address} | ${d.reservation_name} | ${d.price}${d.currency} ${d.payment_type} | Adil in attendees: ${hasAdil}`);
        if (hasAdil && dateStr && dateStr.startsWith('2026-07-09')) target = g;
        if (!target && hasAdil) target = g;
    }

    if (!target) {
        console.log('\nNo target game with Adil found in Danny recent games. Searching games collection by date+reservation...');
        const start = new Date('2026-07-09T00:00:00Z');
        const end = new Date('2026-07-10T06:00:00Z');
        const snap = await db.collection('games')
            .where('date', '>=', start).where('date', '<=', end).get();
        console.log(`Found ${snap.size} games on 9 July.`);
        for (const doc of snap.docs) {
            const d = doc.data();
            const attIds = (d.attendees || []).map(r => r.id);
            if (attIds.includes(ADIL_UID) || attIds.includes(DANNY_UID) || (d.reservation_name || '').toLowerCase().includes('speed')) {
                console.log(`  candidate ${doc.id} | ${ts(d.date)} | ${d.reservation_name} | ${d.address} | Adil:${attIds.includes(ADIL_UID)} Danny:${attIds.includes(DANNY_UID)}`);
                if (attIds.includes(ADIL_UID)) target = { id: doc.id, ref: doc.ref, data: d };
            }
        }
    }

    if (!target) { console.log('\n=== NO TARGET GAME FOUND ==='); process.exit(0); }

    const d = target.data;
    console.log('\n\n########## TARGET GAME ##########');
    console.log('id:', target.id);
    console.log('date:', ts(d.date), '| status:', d.status);
    console.log('address:', d.address, '| reservation_name:', d.reservation_name);
    console.log('price:', d.price, d.currency, '| price_undiscounted:', d.price_undiscounted, '| payment_type:', d.payment_type);
    console.log('organizer:', d.organizer);
    console.log('max_players:', d.max_players, '| duration:', d.duration);
    console.log('attendees:', (d.attendees || []).map(r => r.id));
    console.log('no_show_players:', (d.no_show_players || []).map(r => r.id));
    console.log('late_players:', (d.late_players || []).map(r => r.id));
    console.log('rude_players:', (d.rude_players || []).map(r => r.id));
    console.log('payments:', (d.payments || []).map(r => r.id));
    console.log('payment_link:', d.payment_link);

    // Resolve attendee names
    console.log('\n--- Attendee names ---');
    for (const r of (d.attendees || [])) {
        try {
            const u = await r.get();
            if (u.exists) {
                const ud = u.data();
                console.log(`  ${r.id}: ${ud.display_name} | ${ud.phone_number} | banned:${ud.banned}`);
            } else {
                console.log(`  ${r.id}: (not a user doc / outsider)`);
            }
        } catch (e) { console.log(`  ${r.id}: err ${e.message}`); }
    }

    // Chat messages
    console.log('\n\n########## CHAT MESSAGES ##########');
    const msgs = await db.collection('messages').where('game_id', '==', target.ref).get();
    const arr = msgs.docs.map(m => ({ id: m.id, ...m.data() }));
    arr.sort((a, b) => {
        const ca = a.created && a.created.toDate ? a.created.toDate().getTime() : 0;
        const cb = b.created && b.created.toDate ? b.created.toDate().getTime() : 0;
        return ca - cb;
    });
    console.log(`${arr.length} messages:`);
    for (const m of arr) {
        console.log(`\n[${ts(m.created)}] ${m.author_name} (${m.type || 'msg'}): ${m.text}`);
    }

    // Payments on the game
    console.log('\n\n########## PAYMENTS ##########');
    for (const pRef of (d.payments || [])) {
        try {
            const p = await pRef.get();
            if (p.exists) {
                const pd = p.data();
                console.log(`  payment ${p.id}: amount=${pd.amount} status=${pd.status} user=${pd.user_ref ? pd.user_ref.id : '?'} intent=${pd.payment_intent_id}`);
            }
        } catch (e) {}
    }

    process.exit(0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
