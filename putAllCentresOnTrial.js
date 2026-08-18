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

        // Calculate the Paris time for November 1st at 00:00:00
        const parisTime = new Date('2023-11-01T12:00:00');
        parisTime.setHours(parisTime.getHours() + 2); // Paris time is UTC+2

        // Update documents where "type" is "pro"
        const querySnapshot = await collectionRef.where('type', '==', 'pro').get();

        const batch = db.batch();

        querySnapshot.forEach((doc) => {
            batch.update(doc.ref, {
                centre_plan_status: 'trial',
                centre_plan_next_renew: parisTime,
            });

            // Delete the "next_renew_date" field
            batch.update(doc.ref, {
                next_renew_date: admin.firestore.FieldValue.delete(),
            });

            // Log the update for each center
            console.log(`${doc.data().display_name} is on trial and centre_plan_next_renew is set to November 1st (and next_renew_date has disappeared)`);
        });

        // Commit the batch update
        await batch.commit();

        console.log('Documents updated successfully');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

putAllCentresOnTrial();
