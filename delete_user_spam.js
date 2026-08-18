const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const USER_ID = 'n3R2uzshLmftuthw5S5G7k14amb2';
const HOURS_BACK = 72;
const DRY_RUN = false;

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
        if (data.created.toDate() < cutoff) return;
        recent.push({ id: doc.id, gameId: data.game_id ? data.game_id.id : null });
    });

    console.log(`Found ${recent.length} messages from user in the last ${HOURS_BACK}h.`);

    if (DRY_RUN) {
        console.log('DRY RUN — not deleting.');
        process.exit(0);
    }

    // Group by game for efficient game doc updates
    const byGame = {};
    for (const msg of recent) {
        if (!msg.gameId) continue;
        if (!byGame[msg.gameId]) byGame[msg.gameId] = [];
        byGame[msg.gameId].push(msg.id);
    }

    // Batch delete (Firestore limit: 500 ops per batch)
    let batch = db.batch();
    let opsInBatch = 0;
    let totalDeleted = 0;

    for (const msg of recent) {
        batch.delete(db.collection('messages').doc(msg.id));
        opsInBatch++;
        if (opsInBatch >= 450) {
            await batch.commit();
            totalDeleted += opsInBatch;
            console.log(`Committed batch of ${opsInBatch} deletes (running total: ${totalDeleted})`);
            batch = db.batch();
            opsInBatch = 0;
        }
    }
    if (opsInBatch > 0) {
        await batch.commit();
        totalDeleted += opsInBatch;
        console.log(`Committed final batch of ${opsInBatch} deletes (total: ${totalDeleted})`);
    }

    console.log(`\nDeleted ${totalDeleted} messages.`);

    // Update game docs to remove deleted message references
    let gamesUpdated = 0;
    for (const [gameId, deletedIds] of Object.entries(byGame)) {
        const gameRef = db.collection('games').doc(gameId);
        const gameDoc = await gameRef.get();
        if (!gameDoc.exists) continue;
        const currentMessages = gameDoc.data().messages || [];
        const filtered = currentMessages.filter(ref => !deletedIds.includes(ref.id));
        if (filtered.length !== currentMessages.length) {
            await gameRef.update({ messages: filtered });
            gamesUpdated++;
        }
    }
    console.log(`Updated ${gamesUpdated} game documents.`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
