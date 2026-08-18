const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function run() {
    const BATCH_SIZE = 500;
    const cutoffDate = new Date('2025-05-20T00:00:00Z');
    let totalUpdated = 0;
    let lastDoc = null;

    console.log(`\n🔁 Starting batched update for 'connect' docs where datetime >= ${cutoffDate.toISOString()} and source == "game_invitations"\n`);

    while (true) {
        let query = db.collection('connect')
            .where('source', '==', 'game_invitations')
            .where('datetime', '>=', cutoffDate)
            .orderBy('datetime')
            .limit(BATCH_SIZE);

        if (lastDoc) {
            query = query.startAfter(lastDoc);
        }

        console.log('⏳ Fetching next batch...');
        let snapshot;
        try {
            snapshot = await query.get();
        } catch (err) {
            console.error('❌ Error during Firestore query:', err);
            break;
        }

        if (snapshot.empty) {
            console.log('✅ No more documents to update.');
            break;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            const ref = doc.ref;
            const data = doc.data();
            console.log(`→ Queuing update for doc ID: ${ref.id}, datetime: ${data.datetime.toDate().toISOString()}, current source: ${data.source}`);
            batch.update(ref, { source: 'game_invitation' });
        });

        try {
            console.log(`⚙️ Committing batch of ${snapshot.size} updates...`);
            await batch.commit();
            totalUpdated += snapshot.size;
        } catch (err) {
            console.error('❌ Error committing batch:', err);
            break;
        }

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }

    console.log(`\n✅ Update complete. Total documents updated: ${totalUpdated}\n`);
}

run().catch((error) => {
    console.error('❌ Error running script:', error);
});