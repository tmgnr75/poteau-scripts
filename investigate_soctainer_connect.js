const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_IDS = ['0ksCjVGqhB5uNc6ZO6Du', 'D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];
const AXEL_UID = 'XNPognOy0OgAklzAAknSsuvjTwN2';

async function main() {
    // Try messages where author_id is Axel ref OR user is Axel, possibly trigger-type "creation"
    // Broaden: any message authored by Axel created recently (around 06-05)
    const axelRef = db.doc('users/' + AXEL_UID);

    for (const gid of GAME_IDS) {
        const gameRef = db.doc('games/' + gid);
        // try different field names
        for (const field of ['gameId', 'gameRef', 'game']) {
            try {
                const snap = await db.collection('messages').where(field, '==', gameRef).get();
                if (snap.size > 0) console.log(`messages.${field} == ${gid}: ${snap.size}`);
            } catch (e) {}
        }
        // connect entries referencing this game
        const conSnap = await db.collection('connect').where('game', '==', gameRef).get();
        if (conSnap.size > 0) {
            console.log(`\nconnect.game == ${gid}: ${conSnap.size}`);
            conSnap.forEach(c => {
                const cd = c.data();
                console.log(`  connect ${c.id} | type=${cd.type} | title=${JSON.stringify(cd.title)} | msg=${JSON.stringify(cd.message)}`);
            });
        }
    }

    // Messages authored by Axel around creation time
    console.log('\n=== Recent messages authored by Axel (by author_id ref) ===');
    const byAuthor = await db.collection('messages').where('author_id', '==', axelRef).get();
    console.log(`total messages by Axel: ${byAuthor.size}`);
    byAuthor.forEach(m => {
        const md = m.data();
        const created = md.created ? md.created.toDate().toISOString() : 'N/A';
        if (created.startsWith('2026-06')) {
            console.log(`  msg ${m.id} | game_id=${md.game_id ? md.game_id.path : null} | created=${created} | trigger=${md.trigger} | text=${JSON.stringify(md.text)}`);
        }
    });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
