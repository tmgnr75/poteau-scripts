const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const USER_ID = 'n3R2uzshLmftuthw5S5G7k14amb2';

// Only delete messages from this specific game (set to null to preview all)
const TARGET_GAME_ID = null;

// Set to true to actually delete, false to just preview
const DRY_RUN = true;

async function main() {
    const userRef = db.collection('users').doc(USER_ID);

    // Find all messages from this user
    const messagesSnapshot = await db.collection('messages')
        .where('author_id', '==', userRef)
        .get();

    console.log(`Found ${messagesSnapshot.size} messages from user ${USER_ID} in the last 7 days.\n`);

    if (messagesSnapshot.empty) {
        console.log('No messages found.');
        process.exit(0);
    }

    // Filter messages for target game only (or all if TARGET_GAME_ID is null)
    const messagesByGame = {};
    messagesSnapshot.forEach(doc => {
        const data = doc.data();
        const gameId = data.game_id ? data.game_id.id : 'unknown';
        if (TARGET_GAME_ID && gameId !== TARGET_GAME_ID) return;
        if (!messagesByGame[gameId]) {
            messagesByGame[gameId] = [];
        }
        messagesByGame[gameId].push({ id: doc.id, data });
    });

    const totalToDelete = Object.values(messagesByGame).reduce((sum, msgs) => sum + msgs.length, 0);
    console.log(`Filtered to ${totalToDelete} messages on game ${TARGET_GAME_ID}.\n`);

    // Display messages grouped by game
    for (const [gameId, messages] of Object.entries(messagesByGame)) {
        console.log(`\n=== Game: ${gameId} (${messages.length} messages) ===`);
        messages.forEach((msg, i) => {
            const created = msg.data.created ? msg.data.created.toDate().toISOString() : 'N/A';
            const text = msg.data.text || '[empty]';
            const type = msg.data.type || 'chat';
            console.log(`  ${i + 1}. [${created}] (${type}) ${text} (ID: ${msg.id})`);
        });
    }

    if (DRY_RUN) {
        console.log('\n--- DRY RUN MODE ---');
        console.log('Set DRY_RUN = false to actually delete these messages.');
        console.log(`Total messages to delete: ${totalToDelete}`);
    } else {
        console.log('\n--- DELETING MESSAGES ---');
        const batch = db.batch();
        let count = 0;

        for (const msgs of Object.values(messagesByGame)) {
            for (const msg of msgs) {
                batch.delete(db.collection('messages').doc(msg.id));
                count++;
            }
        }

        await batch.commit();
        console.log(`Successfully deleted ${count} messages.`);

        // Also remove message references from game documents
        for (const gameId of Object.keys(messagesByGame)) {
            const gameRef = db.collection('games').doc(gameId);
            const gameDoc = await gameRef.get();
            if (gameDoc.exists && gameDoc.data().messages) {
                const deletedIds = messagesByGame[gameId].map(m => m.id);
                const currentMessages = gameDoc.data().messages || [];
                const filteredMessages = currentMessages.filter(
                    ref => !deletedIds.includes(ref.id)
                );
                if (filteredMessages.length !== currentMessages.length) {
                    await gameRef.update({ messages: filteredMessages });
                    console.log(`Updated game ${gameId}: removed ${currentMessages.length - filteredMessages.length} message refs.`);
                }
            }
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
