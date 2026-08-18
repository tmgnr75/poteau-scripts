const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function explore() {
    // Grab 10 recent games to inspect structure
    const snapshot = await db.collection('games')
        .orderBy('date', 'desc')
        .limit(10)
        .get();

    snapshot.forEach(doc => {
        const data = doc.data();
        console.log('=== DOC ID:', doc.id, '===');
        // Print all field names, types, and sample values
        for (const [key, value] of Object.entries(data)) {
            let type = typeof value;
            let display = value;

            if (value === null) {
                type = 'null';
                display = 'null';
            } else if (value instanceof admin.firestore.Timestamp) {
                type = 'Timestamp';
                display = value.toDate().toISOString();
            } else if (value instanceof admin.firestore.GeoPoint) {
                type = 'GeoPoint';
                display = `(${value.latitude}, ${value.longitude})`;
            } else if (value instanceof admin.firestore.DocumentReference) {
                type = 'DocumentReference';
                display = value.path;
            } else if (Array.isArray(value)) {
                type = `Array[${value.length}]`;
                // Show first 2 elements
                display = value.slice(0, 2).map(v => {
                    if (v instanceof admin.firestore.DocumentReference) return v.path;
                    if (v instanceof admin.firestore.Timestamp) return v.toDate().toISOString();
                    if (typeof v === 'object') return JSON.stringify(v);
                    return v;
                });
            } else if (typeof value === 'object') {
                type = 'Object';
                display = JSON.stringify(value).substring(0, 200);
            }

            console.log(`  ${key} (${type}): ${Array.isArray(display) ? JSON.stringify(display) : display}`);
        }
        console.log('');
    });

    // Also count total docs
    const countSnap = await db.collection('games').count().get();
    console.log('TOTAL GAMES COUNT:', countSnap.data().count);

    process.exit(0);
}

explore().catch(e => { console.error(e); process.exit(1); });
