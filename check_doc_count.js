const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function getCountsByDate(startDate, endDate) {
    let currentDate = new Date(startDate);
    endDate = new Date(endDate);

    console.log('Connect collection');
    await printCollectionCounts('connect', 'datetime', currentDate, endDate);

    console.log('\nGame Invitations collection');
    currentDate = new Date(startDate);  // Reset the date
    await printCollectionCounts('game_invitations', 'created', currentDate, endDate);
}

async function printCollectionCounts(collectionName, dateField, startDate, endDate) {
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const formattedDate = currentDate.toISOString().split('T')[0];
        const startOfDay = new Date(formattedDate);
        const endOfDay = new Date(formattedDate);
        endOfDay.setDate(endOfDay.getDate() + 1);

        const count = await getCountForCollection(collectionName, dateField, startOfDay, endOfDay);
        console.log(`${formattedDate}: ${count}`);

        currentDate.setDate(currentDate.getDate() + 1);
    }
}

async function getCountForCollection(collectionName, dateField, start, end) {
    const snapshot = await db.collection(collectionName)
        .where(dateField, '>=', start)
        .where(dateField, '<', end)
        .get();
    return snapshot.size;
}

// Run the function with the specified date range
const startDate = '2024-10-25';
const endDate = '2024-11-06';
getCountsByDate(startDate, endDate)
    .then(() => console.log('Counting completed.'))
    .catch(error => console.error('Error counting documents:', error));