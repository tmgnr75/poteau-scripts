const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const USER_ID = 'n3R2uzshLmftuthw5S5G7k14amb2';

async function main() {
    const doc = await db.collection('users').doc(USER_ID).get();
    if (!doc.exists) {
        console.log('User not found');
        process.exit(1);
    }
    const d = doc.data();
    console.log('=== User Info ===');
    console.log('display_name:', d.display_name);
    console.log('first_name:', d.first_name);
    console.log('last_name:', d.last_name);
    console.log('nickname:', d.nickname);
    console.log('email:', d.email);
    console.log('phone_number:', d.phone_number);
    console.log('uid:', d.uid);
    console.log('banned:', d.banned);
    console.log('created_time:', d.created_time ? d.created_time.toDate().toISOString() : null);
    console.log('last_activity_date:', d.last_activity_date ? d.last_activity_date.toDate().toISOString() : null);
    console.log('photo_url:', d.photo_url);
    console.log('hash_pic:', d.hash_pic);
    console.log('country:', d.country);
    console.log('country_code:', d.country_code);
    console.log('birthday:', d.birthday ? d.birthday.toDate().toISOString() : null);

    // Auth info
    try {
        const authUser = await admin.auth().getUser(USER_ID);
        console.log('\n=== Firebase Auth ===');
        console.log('email (auth):', authUser.email);
        console.log('phoneNumber (auth):', authUser.phoneNumber);
        console.log('displayName (auth):', authUser.displayName);
        console.log('providers:', authUser.providerData.map(p => `${p.providerId}: ${p.email || p.phoneNumber || p.uid}`));
        console.log('disabled:', authUser.disabled);
        console.log('createdAt:', authUser.metadata.creationTime);
        console.log('lastSignInAt:', authUser.metadata.lastSignInTime);
    } catch (e) {
        console.log('Auth lookup failed:', e.message);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
