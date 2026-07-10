const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
const MEHDI_UID = 'WbM8LRz0oXcbaGv0r4VMIv9j8Kn2';
function ts(v) { return v && v.toDate ? v.toDate().toISOString() : v; }

async function dumpGames(uid, label) {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { console.log(label, 'NOT FOUND'); return; }
    const d = doc.data();
    console.log(`\n=== ${label} (${uid}) ===`);
    console.log('display_name:', d.display_name, '| banned:', d.banned, '| phone:', d.phone_number, '| email:', d.email);
    console.log('last_activity:', ts(d.last_activity_date));
    const played = d.played_games || [];
    console.log(`played_games: ${played.length}`);
    for (const r of played) {
        try {
            const g = await r.get();
            if (!g.exists) { console.log(`  ${r.id}: (missing)`); continue; }
            const gd = g.data();
            console.log(`  ${r.id}: ${ts(gd.date)} | ${gd.status} | org=${gd.organizer} | ${gd.reservation_name} | ${gd.price}${gd.currency} ${gd.payment_type}`);
        } catch (e) { console.log(`  ${r.id}: err`); }
    }
}

async function main() {
    await dumpGames(ADIL_UID, 'ADIL');
    await dumpGames(MEHDI_UID, 'MEHDI MOUMEN (same phone)');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
