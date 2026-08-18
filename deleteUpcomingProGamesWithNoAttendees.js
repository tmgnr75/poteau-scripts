const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();


async function deleteUpcomingProGamesWithNoAttendees() {
    const currentDate = new Date();
    const futureDate = new Date('2023-10-29'); // October 29, 2023
    let deletedCount = 0;

    // Query for games of type "pro" with a start date greater than or equal to October 29, 2023
    const querySnapshot = await db.collection('games')
        .where('type', '==', 'pro')
        .where('date', '>=', futureDate)
        .get();

    // Iterate through the documents and delete them if attendees are missing or empty
    querySnapshot.forEach(async (doc) => {
        const attendees = doc.get('attendees');
        const centre = doc.get('centre');
        const date = doc.get('date').toDate().toISOString(); // Format date as YYYY-MM-DD HH:MM

        if (!attendees || attendees.length === 0) {
            // Delete the game since 'attendees' field is missing or empty
            await doc.ref.delete();
            console.log(`Deleted game with ID: ${doc.id}, Centre: ${centre}, Date: ${date}`);
            deletedCount++;
        } else {
            // Skip the game since 'attendees' field is set and not empty
            console.log(`Skipping game with attendees: ${doc.id}, Centre: ${centre}, Date: ${date}`);
        }
    });

    console.log(`Total deleted documents: ${deletedCount}`);
}

// Call the function to delete upcoming pro games with no attendees
deleteUpcomingProGamesWithNoAttendees().catch((error) => {
    console.error('Error deleting games:', error);
});