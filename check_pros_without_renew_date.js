const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function checkProsWithoutRenewDate() {
    try {
        const proSnapshot = await db.collection('users').where('type', '==', 'pro').get();
        const superProSnapshot = await db.collection('users').where('type', '==', 'super_pro').get();

        const allDocs = [...proSnapshot.docs, ...superProSnapshot.docs];

        let withRenew = 0;
        let withoutRenew = [];

        allDocs.forEach(doc => {
            const data = doc.data();
            const value = data.centre_plan_next_renew;

            // Check if field exists, is not null, and is not empty string
            if (value !== undefined && value !== null && value !== '') {
                withRenew++;
            } else {
                const reason = value === undefined ? 'missing' : value === null ? 'null' : 'empty';
                withoutRenew.push({ name: data.display_name || doc.id, reason });
            }
        });

        console.log(`\n=== Results ===`);
        console.log(`Total pro/super_pro users: ${allDocs.length}`);
        console.log(`With centre_plan_next_renew: ${withRenew}`);
        console.log(`Without centre_plan_next_renew: ${withoutRenew.length}`);

        if (withoutRenew.length > 0) {
            console.log(`\nUsers without centre_plan_next_renew:`);
            withoutRenew.forEach(u => console.log(`  - ${u.name} (${u.reason})`));
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        admin.app().delete();
    }
}

checkProsWithoutRenewDate();
