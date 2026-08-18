const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Pass email as CLI arg: node inspect_apple_user.js k6zs28p82n@privaterelay.appleid.com
const EMAIL = process.argv[2];

if (!EMAIL) {
    console.error('Usage: node inspect_apple_user.js <email>');
    process.exit(1);
}

async function main() {
    let authUser;
    try {
        authUser = await admin.auth().getUserByEmail(EMAIL);
    } catch (e) {
        console.log(`[NOT FOUND in Auth by email] ${EMAIL}`);
        console.log(`Error: ${e.message}`);
        process.exit(1);
    }

    const uid = authUser.uid;
    console.log('=== Firebase Auth ===');
    console.log('uid:', uid);
    console.log('email:', authUser.email);
    console.log('emailVerified:', authUser.emailVerified);
    console.log('phoneNumber:', authUser.phoneNumber);
    console.log('displayName:', authUser.displayName);
    console.log('disabled:', authUser.disabled);
    console.log('createdAt:', authUser.metadata.creationTime);
    console.log('lastSignInAt:', authUser.metadata.lastSignInTime);
    console.log('providers:');
    authUser.providerData.forEach(p => {
        console.log(`  - ${p.providerId} | email: ${p.email || 'N/A'} | uid: ${p.uid}`);
    });
    const hasPassword = authUser.providerData.some(p => p.providerId === 'password');
    const hasApple = authUser.providerData.some(p => p.providerId === 'apple.com');
    console.log('hasPasswordProvider:', hasPassword);
    console.log('hasAppleProvider:', hasApple);

    console.log('\n=== Firestore users/' + uid + ' ===');
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        console.log('No Firestore document.');
        process.exit(0);
    }
    const d = userDoc.data();
    console.log('display_name:', d.display_name);
    console.log('first_name:', d.first_name);
    console.log('last_name:', d.last_name);
    console.log('email:', d.email);
    console.log('phone_number:', d.phone_number);
    console.log('type:', d.type);
    console.log('language:', d.language);
    console.log('country:', d.country);
    console.log('banned:', d.banned);
    console.log('created_time:', d.created_time ? d.created_time.toDate().toISOString() : null);
    console.log('last_activity_date:', d.last_activity_date ? d.last_activity_date.toDate().toISOString() : null);
    console.log('played_games count:', (d.played_games || []).length);
    console.log('upcoming_games count:', (d.upcoming_games || []).length);

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
