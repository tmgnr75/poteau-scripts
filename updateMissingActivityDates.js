const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

async function updateMissingActivityDates() {
    console.log('Starting update of missing last_activity_date fields...');

    // Fetch all users, selecting only the last_activity_date field
    const usersSnapshot = await db.collection('users')
        .select('last_activity_date') // Select only the field you need
        .get();

    const batch = db.batch();
    let updatedCount = 0;

    usersSnapshot.forEach((doc) => {
        const data = doc.data();

        // Check if last_activity_date is missing or explicitly null
        if (!data.last_activity_date) {
            batch.update(doc.ref, {
                last_activity_date: new Date('1970-01-01T00:00:00Z'), // Default date
            });
            updatedCount++;
        }
    });

    // Commit the batch
    if (updatedCount > 0) {
        await batch.commit();
        console.log(`Update completed. Total users updated: ${updatedCount}`);
    } else {
        console.log('No users needed updating.');
    }
}

updateMissingActivityDates().catch((error) => {
    console.error('Error updating missing last_activity_date fields:', error);
});