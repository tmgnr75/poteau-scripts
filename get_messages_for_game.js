const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const GAME_ID = '0Zf9cQgtB6FyCTjps69r';

async function getMessagesForGame() {
    try {
        // Get the game document reference
        const gameRef = db.collection('games').doc(GAME_ID);

        // Query messages by game_id
        const messagesSnapshot = await db.collection('messages')
            .where('game_id', '==', gameRef)
            .orderBy('created', 'desc')
            .get();

        console.log(`\n=== Messages for Game ${GAME_ID} ===`);
        console.log(`Total messages found: ${messagesSnapshot.size}\n`);

        if (messagesSnapshot.empty) {
            console.log('No messages found for this game.');

            // Let's also check the game document to see if it has messages array
            const gameDoc = await gameRef.get();
            if (gameDoc.exists) {
                const gameData = gameDoc.data();
                console.log('\n=== Game Document ===');
                console.log('Messages array in game:', gameData.messages ? gameData.messages.length : 0);
                if (gameData.messages && gameData.messages.length > 0) {
                    console.log('Message refs:', gameData.messages.map(m => m.id));
                }
            } else {
                console.log('Game document does not exist!');
            }
        } else {
            messagesSnapshot.forEach((doc, index) => {
                const data = doc.data();
                console.log(`\n--- Message ${index + 1} (ID: ${doc.id}) ---`);
                console.log('Document ID:', doc.id);
                console.log('Type:', data.type || 'N/A');
                console.log('Trigger:', data.trigger || 'N/A');
                console.log('Source:', data.source || 'N/A');
                console.log('Author ID:', data.author_id ? data.author_id.id : 'N/A');
                console.log('Author Name:', data.author_name || 'N/A');
                console.log('Text (FR):', data.text || '[EMPTY]');
                console.log('Text (EN):', data.text_en || '[EMPTY]');
                console.log('Text (ES):', data.text_es || '[EMPTY]');
                console.log('Text (IT):', data.text_it || '[EMPTY]');
                console.log('Created:', data.created ? data.created.toDate().toISOString() : 'N/A');
                console.log('Pictures:', data.pictures ? JSON.stringify(data.pictures) : 'None');
                console.log('Reactions:', data.reactions ? JSON.stringify(data.reactions) : 'None');
                console.log('Reason Why:', data.reason_why || 'N/A');

                // Show all raw fields for debugging
                console.log('\n--- Raw Document Data ---');
                console.log(JSON.stringify(data, (key, value) => {
                    if (value && value._path) {
                        return `[DocumentReference: ${value._path.segments.join('/')}]`;
                    }
                    if (value && value.toDate) {
                        return value.toDate().toISOString();
                    }
                    return value;
                }, 2));
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

getMessagesForGame();
