const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

const SUSPECTS = {
    sVaBM5QOhtNMAxWYSXKGm9H0Arf2: 'Kassim',
    TBi7xlZkIgcTwhoT3JXmuO6xuMS2: 'Fawzi Fawzi',
    q0R7EVydkUhwJLqncbal7g7Vcp13: 'Anis Tabu',
};

// Foot Power 5 = Cormeilles-en-Parisis, 36 Rue des Pommiers. Centre name string used on games: "Foot POWER 5"
async function main() {
    // 1. All games whose centre name string is Foot POWER 5, around the complaint window (May 2026)
    console.log('=== Games with centre="Foot POWER 5" in 2026 ===');
    const snap = await db.collection('games').where('centre', '==', 'Foot POWER 5').get();
    const games = [];
    snap.forEach(g => {
        const d = g.data();
        games.push({ ref: g.ref, id: g.id, d });
    });
    games.sort((a, b) => (ts(a.d.date) || '').localeCompare(ts(b.d.date) || ''));

    for (const { id, d } of games) {
        const date = ts(d.date);
        const att = (d.attendees || []).map(a => a?.path || a);
        const suspectsIn = Object.keys(SUSPECTS).filter(uid => att.some(p => typeof p === 'string' && p.includes(uid)));
        console.log(`game ${id} | ${date} | status=${d.status} | maxP=${d.max_players} | att=${att.length} | outsiders=${(d.outsiders||[]).length} | noShow=${(d.no_show_players||[]).length} | suspects=[${suspectsIn.map(u=>SUSPECTS[u]).join(',')}] | created=${ts(d.created_on)}`);
    }

    // 2. Find the 2026-05-08 ~19:30 game (UTC+2 => 17:30 UTC) specifically — look for May 8 games
    console.log('\n=== Candidate incident games on 2026-05-08 (any centre) ===');
    const start = new Date('2026-05-08T00:00:00Z');
    const end = new Date('2026-05-09T06:00:00Z');
    const daySnap = await db.collection('games')
        .where('date', '>=', start).where('date', '<=', end).get();
    const dayGames = [];
    daySnap.forEach(g => {
        const d = g.data();
        const att = (d.attendees || []).map(a => a?.path || a);
        const suspectsIn = Object.keys(SUSPECTS).filter(uid => att.some(p => typeof p === 'string' && p.includes(uid)));
        dayGames.push({ ref: g.ref, id: g.id, d, suspectsIn });
    });
    for (const { id, d, suspectsIn } of dayGames) {
        console.log(`game ${id} | ${ts(d.date)} | centre=${d.centre} | status=${d.status} | maxP=${d.max_players} | att=${(d.attendees||[]).length} | suspects=[${suspectsIn.map(u=>SUSPECTS[u]).join(',')}] | addr=${(d.address||'').slice(0,45)}`);
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
