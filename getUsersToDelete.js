const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function getUsersToDelete() {
    try {
        const querySnapshot = await db.collection('connect').where('source', '==', 'deletion').get();

        const userIds = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.sender) {
                userIds.push(data.sender.id);
            }
        });

        // Log the user document IDs in batches of 100
        const batchSize = 100;
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            console.log('User Document IDs to Delete (Batch):', batch);
        }
    } catch (error) {
        console.error('Error querying Firestore:', error);
    }
}

getUsersToDelete();
