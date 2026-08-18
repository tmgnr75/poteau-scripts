const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'krank-club'
    });
}

const db = admin.firestore();

async function countPlaceIds() {
    const snapshot = await db.collection('alerts').get();

    const placeIdCounts = {};
    let totalRefs = 0;

    snapshot.forEach(doc => {
        const places = doc.data().places || [];
        places.forEach(p => {
            if (p.placeId) {
                totalRefs++;
                placeIdCounts[p.placeId] = (placeIdCounts[p.placeId] || { count: 0, name: p.centre });
                placeIdCounts[p.placeId].count++;
            }
        });
    });

    const uniqueCount = Object.keys(placeIdCounts).length;
    const top = Object.entries(placeIdCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);

    console.log(`Total placeId references: ${totalRefs}`);
    console.log(`Unique placeIds: ${uniqueCount}`);
    console.log(`\nTop 10 most common:`);
    top.forEach(([id, { count, name }], i) => {
        console.log(`  ${i + 1}. ${name} (${id}) — ${count} alerts`);
    });

    process.exit(0);
}

countPlaceIds().catch(err => { console.error(err); process.exit(1); });
