const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateUserCentreShare() {
    try {
        const usersSnapshot = await db.collection('users').where('type', '==', 'pro').get();

        const batch = db.batch();

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const userRef = db.collection('users').doc(userDoc.id);
            batch.update(userRef, { centre_share_onsite: true });
            console.log(`Updated display name: ${userData.display_name} with centre_share_onsite set to true.`);
        });

        await batch.commit();
        console.log('All users updated successfully.');
    } catch (error) {
        console.error('Error updating users:', error);
    }
}

updateUserCentreShare();
