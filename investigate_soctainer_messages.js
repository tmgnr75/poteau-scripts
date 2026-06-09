const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_IDS = ['0ksCjVGqhB5uNc6ZO6Du', 'D9ycDPTLBuCq2WxhcESs', 'b9EMpmZHu5YhUX9MGrKk', 'RqpcrfXrYOzB5JgKTaEb', 'eDHhb4e5VHlePIVrzwNi', 'vqY0lC691dAP6OMEATPI'];

async function main() {
    // 1) Full team struct of the keeper game
    const keeper = await db.collection('games').doc(GAME_IDS[0]).get();
    console.log('=== KEEPER full doc keys ===');
    console.log(Object.keys(keeper.data()).sort().join(', '));
    console.log('\n=== KEEPER teams full ===');
    console.log(JSON.stringify(keeper.data().teams, null, 2));
    console.log('\n=== KEEPER attendees / interested / outsiders ===');
    const d = keeper.data();
    console.log('attendees:', (d.attendees||[]).map(r=>r.path));
    console.log('interested:', (d.interested||[]).map(r=>r.path));
    console.log('outsiders:', (d.outsiders||[]).map(r=>r.path));
    console.log('players_to_find:', d.players_to_find, '| max_players:', d.max_players);

    // 2) Messages for each game
    for (const gid of GAME_IDS) {
        const msgSnap = await db.collection('messages').where('game_id', '==', db.doc('games/' + gid)).get();
        console.log(`\n=== messages for game ${gid}: ${msgSnap.size} ===`);
        msgSnap.forEach(m => {
            const md = m.data();
            console.log(`  msg ${m.id} | type=${md.type} | trigger=${md.trigger} | author=${md.author_name}`);
            console.log(`    text:    ${JSON.stringify(md.text)}`);
            console.log(`    text_en: ${JSON.stringify(md.text_en)}`);
            console.log(`    text_es: ${JSON.stringify(md.text_es)}`);
            console.log(`    text_it: ${JSON.stringify(md.text_it)}`);
        });
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
