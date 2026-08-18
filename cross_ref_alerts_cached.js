const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'krank-club'
    });
}

const db = admin.firestore();

async function crossRef() {
    // 1. Get all unique placeIds from alerts
    const alertsSnap = await db.collection('alerts').get();
    const alertPlaceIds = new Set();
    alertsSnap.forEach(doc => {
        (doc.data().places || []).forEach(p => {
            if (p.placeId) alertPlaceIds.add(p.placeId);
        });
    });
    console.log(`Unique placeIds from alerts: ${alertPlaceIds.size}`);

    // 2. Get all cachedCentres
    const cachedSnap = await db.collection('cachedCentres').get();
    const cachedByPlaceId = new Map();
    const cachedDocIds = new Set();
    let sampleDoc = null;
    let sampleDocWithLocation = null;

    cachedSnap.forEach(doc => {
        const data = doc.data();
        cachedDocIds.add(doc.id);

        // Check if doc ID is a placeId or if there's a placeId field
        const placeId = data.placeId || data.place_id || doc.id;
        cachedByPlaceId.set(placeId, { docId: doc.id, data });

        if (!sampleDoc) sampleDoc = { id: doc.id, fields: Object.keys(data), data };
        if (!sampleDocWithLocation && (data.location || data.lat || data.latitude)) {
            sampleDocWithLocation = { id: doc.id, data };
        }
    });
    console.log(`Total cachedCentres documents: ${cachedSnap.size}`);

    // 3. Cross-reference
    let foundCount = 0;
    let missingCount = 0;
    let foundWithLocation = 0;
    let foundWithoutLocation = 0;
    const missingExamples = [];

    for (const pid of alertPlaceIds) {
        const cached = cachedByPlaceId.get(pid);
        if (cached) {
            foundCount++;
            const d = cached.data;
            if (d.location || d.lat || d.latitude || d.geo_point) {
                foundWithLocation++;
            } else {
                foundWithoutLocation++;
            }
        } else {
            missingCount++;
            if (missingExamples.length < 10) missingExamples.push(pid);
        }
    }

    console.log(`\n--- CROSS-REFERENCE RESULTS ---`);
    console.log(`Alert placeIds found in cachedCentres: ${foundCount}`);
    console.log(`  - with location data: ${foundWithLocation}`);
    console.log(`  - without location data: ${foundWithoutLocation}`);
    console.log(`Alert placeIds MISSING from cachedCentres: ${missingCount}`);

    if (missingExamples.length > 0) {
        console.log(`\nFirst 10 missing placeIds:`);
        missingExamples.forEach(pid => console.log(`  ${pid}`));
    }

    // 4. Show cachedCentres structure
    console.log(`\n--- CACHED CENTRES STRUCTURE ---`);
    if (sampleDoc) {
        console.log(`Fields: ${sampleDoc.fields.join(', ')}`);
        console.log(`\nSample document (ID: ${sampleDoc.id}):`);
        const d = sampleDoc.data;
        for (const [k, v] of Object.entries(d)) {
            if (v && typeof v === 'object' && v._latitude !== undefined) {
                console.log(`  ${k}: GeoPoint(${v._latitude}, ${v._longitude})`);
            } else if (v && typeof v === 'object' && v.toDate) {
                console.log(`  ${k}: ${v.toDate()}`);
            } else {
                console.log(`  ${k}: ${JSON.stringify(v)}`);
            }
        }
    }

    if (sampleDocWithLocation && sampleDocWithLocation.id !== sampleDoc.id) {
        console.log(`\nSample with location (ID: ${sampleDocWithLocation.id}):`);
        const d = sampleDocWithLocation.data;
        for (const [k, v] of Object.entries(d)) {
            if (v && typeof v === 'object' && v._latitude !== undefined) {
                console.log(`  ${k}: GeoPoint(${v._latitude}, ${v._longitude})`);
            } else if (v && typeof v === 'object' && v.toDate) {
                console.log(`  ${k}: ${v.toDate()}`);
            } else {
                console.log(`  ${k}: ${JSON.stringify(v)}`);
            }
        }
    }

    // 5. Check if doc IDs are placeIds
    let docIdIsPlaceId = 0;
    for (const pid of alertPlaceIds) {
        if (cachedDocIds.has(pid)) docIdIsPlaceId++;
    }
    console.log(`\n--- DOC ID CHECK ---`);
    console.log(`Alert placeIds matching cachedCentres doc IDs: ${docIdIsPlaceId}`);

    process.exit(0);
}

crossRef().catch(err => { console.error(err); process.exit(1); });
