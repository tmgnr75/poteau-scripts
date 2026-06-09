const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_IDS = new Set(['0ksCjVGqhB5uNc6ZO6Du', 'D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI']);

async function main() {
    // Scan all messages created on 2026-06-05 (creation day) and see if any reference our games
    const start = admin.firestore.Timestamp.fromDate(new Date('2026-06-05T00:00:00Z'));
    const end = admin.firestore.Timestamp.fromDate(new Date('2026-06-06T00:00:00Z'));
    const snap = await db.collection('messages').where('created', '>=', start).where('created', '<', end).get();
    console.log(`messages created on 2026-06-05: ${snap.size}`);
    let hits = 0;
    snap.forEach(m => {
        const md = m.data();
        const gp = md.game_id ? (md.game_id.path || md.game_id) : '';
        const gid = (''+gp).split('/').pop();
        if (GAME_IDS.has(gid)) {
            hits++;
            console.log(`HIT msg ${m.id} -> ${gid} | type=${md.type} trigger=${md.trigger} author=${md.author_name} text=${JSON.stringify(md.text)}`);
        }
    });
    console.log(`hits referencing our 6 games: ${hits}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
