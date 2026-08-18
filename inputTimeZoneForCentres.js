const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function putAllCentresOnTrial() {
    try {
        const collectionRef = db.collection('users');

        // Update documents where "type" is "pro"
        const querySnapshot = await collectionRef.where('type', '==', 'pro').get();

        const batch = db.batch();

        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, {
                time_zone: 'Europe/Paris',
            });

            // Log the update for each center
            console.log(`${doc.data().display_name}'s timezone set to Paris`);
        });

        // Commit the batch update
        await batch.commit();

        console.log('Documents updated successfully');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

putAllCentresOnTrial();
