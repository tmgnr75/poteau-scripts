const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function exportCachedCentres() {
    try {
        const snapshot = await db.collection('cached_centres').get();
        const centres = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            centres.push({
                doc_id: doc.id,
                centre_name: data.centre_name || ''
            });
        });

        // Sort by centre_name
        centres.sort((a, b) => a.centre_name.localeCompare(b.centre_name));

        fs.writeFileSync('exports/cached_centres.json', JSON.stringify(centres, null, 2));
        console.log(`Exported ${centres.length} centres to exports/cached_centres.json`);
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
}

exportCachedCentres();
