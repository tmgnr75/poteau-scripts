const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_ID = '1zugRWGNn2dvMIs0tuIn';
const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
function ts(v) { return v && v.toDate ? v.toDate().toISOString() : v; }

async function name(uid) {
    if (!uid) return '(none)';
    try { const u = await db.collection('users').doc(uid).get(); return u.exists ? `${u.data().display_name} [${uid}]` : `(no user ${uid})`; }
    catch { return uid; }
}

async function main() {
    const g = await db.collection('games').doc(GAME_ID).get();
    const d = g.data();
    console.log('########## GAME', GAME_ID, '##########');
    console.log('date:', ts(d.date), '| status:', d.status);
    console.log('reservation_name:', d.reservation_name, '| address:', d.address);
    console.log('price:', d.price, d.currency, '| payment_type:', d.payment_type, '| duration:', d.duration);
    console.log('organizer:', await name(d.organizer));
    console.log('max_players:', d.max_players);
    console.log('attendees:', JSON.stringify((d.attendees || []).map(r => r.id)));
    console.log('payments:', JSON.stringify((d.payments || []).map(r => r.id)));
    console.log('payment_link:', d.payment_link);
    console.log('no_show_players:', JSON.stringify((d.no_show_players || []).map(r => r.id)));

    console.log('\n--- TEAMS / SPOTS ---');
    const teams = d.teams || [];
    console.log(JSON.stringify(teams, (k, v) => {
        if (v && v._path) return 'ref:' + v._path.segments.join('/');
        if (v && v.toDate) return v.toDate().toISOString();
        return v;
    }, 2));

    // Resolve any user refs inside teams
    console.log('\n--- Resolving spot occupants ---');
    for (const t of teams) {
        const spots = t.spots || t.players || [];
        for (const s of spots) {
            const ref = s.user || s.player || s.occupant || (s.id ? s : null);
            let uid = null;
            if (ref && ref.id) uid = ref.id;
            console.log(`  status=${s.status} name=${s.name || s.plus_one_name || ''} uid=${uid ? await name(uid) : ''} raw=${JSON.stringify(Object.keys(s))}`);
        }
    }

    console.log('\n########## MESSAGES ##########');
    const msgs = await db.collection('messages').where('game_id', '==', g.ref).get();
    const arr = msgs.docs.map(m => ({ id: m.id, ...m.data() }));
    arr.sort((a, b) => (a.created?.toDate?.().getTime() || 0) - (b.created?.toDate?.().getTime() || 0));
    console.log(`${arr.length} messages:`);
    for (const m of arr) console.log(`[${ts(m.created)}] ${m.author_name} (${m.type || 'msg'}): ${m.text}`);

    console.log('\n########## PAYMENTS ##########');
    for (const pRef of (d.payments || [])) {
        try { const p = await pRef.get(); if (p.exists) { const pd = p.data();
            console.log(`  ${p.id}: amount=${pd.amount} status=${pd.status} user=${await name(pd.user_ref?.id)} date=${ts(pd.authorization_date)}`); } }
        catch (e) {}
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
