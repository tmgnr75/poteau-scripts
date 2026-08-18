const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
function ts(v) { return v && v.toDate ? v.toDate().toISOString() : v; }

async function main() {
    const doc = await db.collection('users').doc(ADIL_UID).get();
    const d = doc.data();
    console.log('=== ADIL contact channels ===');
    console.log('display_name:', d.display_name, '| real name:', d.first_name, d.last_name);
    console.log('firestore email:', d.email);
    console.log('firestore phone:', d.phone_number);
    console.log('auth_email opt-in:', d.auth_email);
    console.log('language:', d.language);

    try {
        const a = await admin.auth().getUser(ADIL_UID);
        console.log('\n--- Firebase Auth ---');
        console.log('auth email:', a.email, '| verified:', a.emailVerified);
        console.log('auth phone:', a.phoneNumber);
        console.log('providers:', a.providerData.map(p => `${p.providerId}: email=${p.email || '-'} phone=${p.phoneNumber || '-'}`).join(' | '));
        console.log('disabled:', a.disabled);
    } catch (e) { console.log('auth err', e.message); }

    console.log('\n=== Verdict ===');
    const isRelay = (d.email || '').includes('privaterelay.appleid.com');
    console.log('Email is Apple private relay:', isRelay, '-> a mail CAN reach him if relay still active');
    console.log('Phone on file:', d.phone_number || '(none)', '-> SMS fallback');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
