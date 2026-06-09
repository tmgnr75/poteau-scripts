const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const AXEL_UID = 'XNPognOy0OgAklzAAknSsuvjTwN2';
const GAME_IDS = ['0ksCjVGqhB5uNc6ZO6Du', 'D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];

async function main() {
    const axelRef = db.doc('users/' + AXEL_UID);

    // game_id might be stored as string, not ref. Try string match.
    for (const gid of GAME_IDS) {
        const s1 = await db.collection('messages').where('game_id', '==', gid).get();
        if (s1.size) console.log(`game_id (string) == ${gid}: ${s1.size}`);
    }

    // Sample Axel's recent system/creation messages to learn the format
    console.log('\n=== Sample of Axel-authored messages with trigger set ===');
    const byAuthor = await db.collection('messages').where('author_id', '==', axelRef).get();
    const samples = [];
    byAuthor.forEach(m => {
        const md = m.data();
        const created = md.created ? md.created.toDate() : null;
        samples.push({ id: m.id, created, md });
    });
    samples.sort((a, b) => (b.created?.getTime()||0) - (a.created?.getTime()||0));
    samples.slice(0, 12).forEach(s => {
        console.log(`\nmsg ${s.id} | created=${s.created?.toISOString()} | type=${s.md.type} | trigger=${s.md.trigger}`);
        console.log(`  game_id: ${s.md.game_id ? (s.md.game_id.path||s.md.game_id) : null}`);
        console.log(`  text:    ${JSON.stringify(s.md.text)}`);
    });

    // Find creation-type messages (trigger relating to creation) authored by Axel referencing any of our games
    console.log('\n=== Any Axel message whose game_id matches our 6 (ref OR string) ===');
    samples.forEach(s => {
        const gp = s.md.game_id ? (s.md.game_id.path || s.md.game_id) : '';
        const gid = (''+gp).split('/').pop();
        if (GAME_IDS.includes(gid)) {
            console.log(`  >> msg ${s.id} -> game ${gid} | trigger=${s.md.trigger} | text=${JSON.stringify(s.md.text)}`);
        }
    });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
