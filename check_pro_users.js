const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const userIds = [
    'gYGkBpA9N0OhLOKlgXx9ja96UA73',
    'nkME2s5zOrP9Boid6uPgOz1Ssfi1'
];

async function checkUsers() {
    console.log('=== Checking Pro Users ===\n');

    for (const userId of userIds) {
        console.log(`--- User ID: ${userId} ---`);

        // Get user doc
        const userDoc = await db.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            console.log('User NOT FOUND!\n');
            continue;
        }

        const userData = userDoc.data();
        console.log('type:', userData.type);
        console.log('centre_plan_status:', userData.centre_plan_status);
        console.log('display_name:', userData.display_name);
        console.log('centre_place_id:', userData.centre_place_id);
        console.log('created_time:', userData.created_time?.toDate?.() || userData.created_time);

        // Check if alerts_centres doc exists for this user
        const alertsCentresSnapshot = await db.collection('alerts_centres').where('user', '==', userDoc.ref).get();
        console.log('alerts_centres doc exists:', !alertsCentresSnapshot.empty);

        if (!alertsCentresSnapshot.empty) {
            console.log('alerts_centres doc ID:', alertsCentresSnapshot.docs[0].id);
        }

        console.log('\n');
    }

    process.exit(0);
}

checkUsers();
