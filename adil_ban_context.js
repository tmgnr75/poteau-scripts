const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
function ts(v) { return v && v.toDate ? v.toDate().toISOString() : v; }

async function main() {
    const doc = await db.collection('users').doc(ADIL_UID).get();
    const d = doc.data();
    console.log('=== ADIL full doc dump (selected) ===');
    console.log('display_name:', d.display_name, '| first:', d.first_name, '| last:', d.last_name);
    console.log('phone_number:', d.phone_number);
    console.log('email:', d.email);
    console.log('banned:', d.banned);
    console.log('type:', d.type);
    console.log('created_time:', ts(d.created_time));
    console.log('last_activity_date:', ts(d.last_activity_date));
    console.log('last_played_date:', ts(d.last_played_date));
    console.log('played_games:', (d.played_games || []).map(r => r.id));
    console.log('upcoming_games:', (d.upcoming_games || []).map(r => r.id));
    console.log('games:', (d.games || []).map(r => r.id));

    // Look for other accounts sharing the phone number
    console.log('\n=== Accounts sharing phone +33620179223 ===');
    const snap = await db.collection('users').where('phone_number', '==', '+33620179223').get();
    for (const u of snap.docs) {
        const ud = u.data();
        console.log(`  ${u.id}: ${ud.display_name} | banned:${ud.banned} | created:${ts(ud.created_time)} | last_activity:${ts(ud.last_activity_date)}`);
    }

    // Accounts sharing the display name "Adil" or last name Dufeignies
    console.log('\n=== Accounts with last_name DUFEIGNIES ===');
    const snap2 = await db.collection('users').where('last_name', '==', 'DUFEIGNIES').get();
    for (const u of snap2.docs) {
        const ud = u.data();
        console.log(`  ${u.id}: ${ud.display_name} (${ud.first_name} ${ud.last_name}) | phone:${ud.phone_number} | banned:${ud.banned}`);
    }

    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
