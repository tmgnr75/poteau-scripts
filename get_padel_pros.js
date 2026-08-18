const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function getPadelPros() {
    try {
        const usersSnapshot = await db.collection('users')
            .where('type', '==', 'pro')
            .where('sports', 'array-contains', 'padel')
            .get();

        if (usersSnapshot.empty) {
            console.log('No pro users with padel found.');
            return;
        }

        console.log(`Found ${usersSnapshot.size} pro users with padel:\n`);

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            console.log(`- ${userData.display_name || '(no name)'}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        admin.app().delete();
    }
}

getPadelPros();
