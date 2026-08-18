const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const UIDS = [
    'n3R2uzshLmftuthw5S5G7k14amb2',
    'c6yOIkNZtROhqPufCkT3U0LJjSI3',
    '5lIdyGuC2pYq9cKNiPPG4GK7mx53',
];
const DRY_RUN = false;

async function main() {
    const now = new Date();

    for (const uid of UIDS) {
        console.log(`\n========== ${uid} ==========`);

        // organizer field is a string (UID), not a DocRef
        const snap = await db.collection('games')
            .where('organizer', '==', uid)
            .where('status', '==', 'published')
            .get();

        const upcoming = [];
        snap.forEach(doc => {
            const d = doc.data();
            if (!d.date) return;
            const date = d.date.toDate();
            if (date < now) return;
            upcoming.push({ id: doc.id, date, address: d.address, attendees: (d.attendees || []).length });
        });

        console.log(`Found ${upcoming.length} upcoming published games organized by this user.`);
        upcoming.forEach((g, i) => {
            console.log(`  ${i+1}. ${g.id} — ${g.date.toISOString()} — ${g.address} — ${g.attendees} attendees`);
        });

        if (DRY_RUN || upcoming.length === 0) continue;

        for (const g of upcoming) {
            await db.collection('games').doc(g.id).update({ status: 'canceled' });
            console.log(`  ✅ Canceled ${g.id}`);
        }
    }

    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
