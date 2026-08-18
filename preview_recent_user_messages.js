const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const USER_ID = 'n3R2uzshLmftuthw5S5G7k14amb2';
const HOURS_BACK = 72;

async function main() {
    const userRef = db.collection('users').doc(USER_ID);
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - HOURS_BACK);

    const messagesSnapshot = await db.collection('messages')
        .where('author_id', '==', userRef)
        .get();

    const recent = [];
    messagesSnapshot.forEach(doc => {
        const data = doc.data();
        if (!data.created) return;
        const createdAt = data.created.toDate();
        if (createdAt < cutoff) return;
        recent.push({ id: doc.id, data, createdAt });
    });

    recent.sort((a, b) => b.createdAt - a.createdAt);

    console.log(`Found ${recent.length} messages in the last ${HOURS_BACK} hours.\n`);

    const byGame = {};
    for (const msg of recent) {
        const gameId = msg.data.game_id ? msg.data.game_id.id : 'unknown';
        if (!byGame[gameId]) byGame[gameId] = [];
        byGame[gameId].push(msg);
    }

    for (const [gameId, msgs] of Object.entries(byGame)) {
        console.log(`\n=== Game: ${gameId} (${msgs.length} messages) ===`);
        msgs.forEach((msg, i) => {
            const text = msg.data.text || '[empty]';
            const type = msg.data.type || 'chat';
            console.log(`  ${i + 1}. [${msg.createdAt.toISOString()}] (${type}) ${text}`);
        });
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
