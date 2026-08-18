const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const EMAIL = 'robin.fuertes@orange.fr';

async function main() {
    // 1. Firebase Auth record
    console.log('=== FIREBASE AUTH ===');
    let authUser = null;
    try {
        authUser = await admin.auth().getUserByEmail(EMAIL);
        console.log('UID:', authUser.uid);
        console.log('Email:', authUser.email);
        console.log('Email verified:', authUser.emailVerified);
        console.log('Disabled:', authUser.disabled);
        console.log('Created:', authUser.metadata.creationTime);
        console.log('Last sign in:', authUser.metadata.lastSignInTime);
        console.log('Providers:', authUser.providerData.map(p => p.providerId).join(', '));
    } catch (e) {
        console.log('No Auth record found for', EMAIL, '->', e.code || e.message);
    }

    // 2. Firestore user doc(s) by email
    console.log('\n=== FIRESTORE users (by email) ===');
    const snap = await db.collection('users').where('email', '==', EMAIL).get();
    if (snap.empty) console.log('No Firestore user with email', EMAIL);
    snap.forEach(doc => {
        const d = doc.data();
        console.log('Doc ID:', doc.id);
        console.log('  display_name:', d.display_name);
        console.log('  phone_number:', d.phone_number);
        console.log('  type:', d.type);
        console.log('  banned:', d.banned);
        console.log('  auth_email:', d.auth_email);
        console.log('  language:', d.language);
        console.log('  connector:', d.connector);
        console.log('  created_time:', d.created_time && d.created_time.toDate());
        console.log('  last_activity_date:', d.last_activity_date && d.last_activity_date.toDate());
    });

    // 3. If Auth UID exists, check the doc by UID too
    if (authUser) {
        console.log('\n=== FIRESTORE user (by Auth UID) ===');
        const byUid = await db.collection('users').doc(authUser.uid).get();
        if (byUid.exists) {
            const d = byUid.data();
            console.log('Doc ID:', byUid.id);
            console.log('  email:', d.email);
            console.log('  display_name:', d.display_name);
            console.log('  auth_email:', d.auth_email);
            console.log('  banned:', d.banned);
        } else {
            console.log('No Firestore doc at users/' + authUser.uid);
        }
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
