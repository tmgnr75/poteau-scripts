const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_IDS = ['0ksCjVGqhB5uNc6ZO6Du', 'D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];

async function main() {
    for (const gid of GAME_IDS) {
        const gameRef = db.doc('games/' + gid);
        for (const field of ['game', 'gameRef', 'game_ref', 'gameId']) {
            // try ref value
            try {
                const snapRef = await db.collection('messages').where(field, '==', gameRef).get();
                if (snapRef.size) {
                    console.log(`\n=== messages.${field}(ref) == ${gid}: ${snapRef.size} ===`);
                    snapRef.forEach(m => dump(m));
                }
            } catch (e) {}
            // try string value
            try {
                const snapStr = await db.collection('messages').where(field, '==', gid).get();
                if (snapStr.size) {
                    console.log(`\n=== messages.${field}(string) == ${gid}: ${snapStr.size} ===`);
                    snapStr.forEach(m => dump(m));
                }
            } catch (e) {}
        }
    }
}

function dump(m) {
    const md = m.data();
    const created = md.created ? md.created.toDate().toISOString() : 'N/A';
    console.log(`  msg ${m.id} | type=${md.type} | trigger=${md.trigger} | author=${md.author_name} | created=${created}`);
    console.log(`    keys: ${Object.keys(md).join(', ')}`);
    console.log(`    text:    ${JSON.stringify(md.text)}`);
    console.log(`    text_en: ${JSON.stringify(md.text_en)}`);
    console.log(`    text_es: ${JSON.stringify(md.text_es)}`);
    console.log(`    text_it: ${JSON.stringify(md.text_it)}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
