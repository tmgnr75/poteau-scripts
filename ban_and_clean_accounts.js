const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const UIDS = [
    'c6yOIkNZtROhqPufCkT3U0LJjSI3',
    '5lIdyGuC2pYq9cKNiPPG4GK7mx53',
];
const HOURS_BACK = 72;

async function processUser(uid) {
    console.log(`\n========== ${uid} ==========`);

    // Ban in Firestore
    await db.collection('users').doc(uid).update({ banned: true });
    console.log(`✅ Firestore: banned=true`);

    // Disable in Firebase Auth
    try {
        await admin.auth().updateUser(uid, { disabled: true });
        console.log(`✅ Auth: disabled=true`);
    } catch (e) {
        console.log(`⚠️  Auth disable failed: ${e.message}`);
    }

    // Find recent messages
    const userRef = db.collection('users').doc(uid);
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
        recent.push({
            id: doc.id,
            gameId: data.game_id ? data.game_id.id : null,
            text: data.text || '[empty]',
            type: data.type || 'chat',
            created: data.created.toDate().toISOString(),
        });
    });

    console.log(`Found ${recent.length} messages in last ${HOURS_BACK}h.`);

    if (recent.length === 0) {
        return;
    }

    // Show what we're about to delete
    recent.slice(0, 10).forEach((m, i) => {
        console.log(`  ${i+1}. [${m.created}] (${m.type}) ${m.text.slice(0, 100)}`);
    });
    if (recent.length > 10) console.log(`  ...and ${recent.length - 10} more`);

    // Group by game
    const byGame = {};
    for (const msg of recent) {
        if (!msg.gameId) continue;
        if (!byGame[msg.gameId]) byGame[msg.gameId] = [];
        byGame[msg.gameId].push(msg.id);
    }

    // Batch delete
    let batch = db.batch();
    let opsInBatch = 0;
    let totalDeleted = 0;

    for (const msg of recent) {
        batch.delete(db.collection('messages').doc(msg.id));
        opsInBatch++;
        if (opsInBatch >= 450) {
            await batch.commit();
            totalDeleted += opsInBatch;
            batch = db.batch();
            opsInBatch = 0;
        }
    }
    if (opsInBatch > 0) {
        await batch.commit();
        totalDeleted += opsInBatch;
    }
    console.log(`✅ Deleted ${totalDeleted} messages.`);

    // Clean game doc message refs
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
    if (gamesUpdated > 0) console.log(`✅ Updated ${gamesUpdated} game documents.`);
}

async function main() {
    for (const uid of UIDS) {
        await processUser(uid);
    }

    // Also disable original main account in Auth (was only banned in Firestore)
    const ORIGINAL = 'n3R2uzshLmftuthw5S5G7k14amb2';
    console.log(`\n========== ${ORIGINAL} (original — verifying auth disabled) ==========`);
    try {
        await admin.auth().updateUser(ORIGINAL, { disabled: true });
        console.log(`✅ Auth: disabled=true`);
    } catch (e) {
        console.log(`⚠️  Auth disable failed: ${e.message}`);
    }

    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
