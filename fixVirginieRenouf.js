const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function fixVirginieRenouf() {
    const virginieUid = '1J4rODXPN7N7urspEYmVOOw65am2';

    try {
        console.log('Updating Virginie Renouf document...');

        await db.collection('users').doc(virginieUid).update({
            centre_plan_next_renew: new Date('2030-01-01'),
            centre_plan_status: 'active',
        });

        console.log('✅ Document updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixVirginieRenouf();
