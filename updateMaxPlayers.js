const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Organizer ID and current timestamp
const ORGANIZER_ID = 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2';
const CURRENT_TIMESTAMP = new Date();

async function updateMaxPlayers() {
    try {
        console.log(`Starting script to update "max_players" for future "games" of organizer: ${ORGANIZER_ID}`);

        // Step 1: Update "max_players" in the "games" collection for future documents
        console.log('Fetching future documents from the "games" collection...');
        const gamesSnapshot = await db.collection('games')
            .where('organizer', '==', ORGANIZER_ID)
            .where('date', '>', CURRENT_TIMESTAMP) // Adjust field name to match your schema
            .get();

        if (gamesSnapshot.empty) {
            console.log(`No documents found in the "games" collection for organizer: ${ORGANIZER_ID}`);
        } else {
            console.log(`Found ${gamesSnapshot.size} document(s) in the "games" collection. Updating "max_players"...`);
            for (const doc of gamesSnapshot.docs) {
                console.log(`Updating "max_players" to 10 for game document ID: ${doc.id}`);
                await doc.ref.update({ max_players: 10 });
                console.log(`Successfully updated "max_players" for game document ID: ${doc.id}`);
            }
        }

        // Step 2: Update "maxPlayers" in the "repeaters" collection
        console.log('Fetching documents from the "repeaters" collection...');
        const repeatersSnapshot = await db.collection('repeaters').where('organizer', '==', ORGANIZER_ID).get();

        if (repeatersSnapshot.empty) {
            console.log(`No documents found in the "repeaters" collection for organizer: ${ORGANIZER_ID}`);
        } else {
            console.log(`Found ${repeatersSnapshot.size} document(s) in the "repeaters" collection. Updating "maxPlayers"...`);
            for (const doc of repeatersSnapshot.docs) {
                console.log(`Updating "maxPlayers" to 10 for repeater document ID: ${doc.id}`);
                await doc.ref.update({ maxPlayers: 10 });
                console.log(`Successfully updated "maxPlayers" for repeater document ID: ${doc.id}`);
            }
        }

        console.log('Script execution completed successfully.');
    } catch (error) {
        console.error('An error occurred during the script execution:', error);
    }
}

// Run the script
updateMaxPlayers();