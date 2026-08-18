const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'krank-club'
    });
}

const db = admin.firestore();

async function findCentres() {
    // Check multiple possible collection names
    const candidates = ['cachedCentres', 'cached_centres', 'centres', 'centers', 'cached-centres'];

    for (const name of candidates) {
        const snap = await db.collection(name).limit(3).get();
        if (snap.size > 0) {
            console.log(`\n=== Collection "${name}" — has documents ===`);
            // Get total count
            const fullSnap = await db.collection(name).get();
            console.log(`Total docs: ${fullSnap.size}`);
            snap.forEach(doc => {
                const data = doc.data();
                console.log(`\nDoc ID: ${doc.id}`);
                for (const [k, v] of Object.entries(data)) {
                    if (v && typeof v === 'object' && v._latitude !== undefined) {
                        console.log(`  ${k}: GeoPoint(${v._latitude}, ${v._longitude})`);
                    } else if (v && typeof v === 'object' && v.toDate) {
                        console.log(`  ${k}: ${v.toDate()}`);
                    } else if (Array.isArray(v)) {
                        console.log(`  ${k}: [${v.length} items] ${JSON.stringify(v.slice(0, 2))}`);
                    } else {
                        console.log(`  ${k}: ${JSON.stringify(v)}`);
                    }
                }
            });

            // Check if any doc has a placeId field or if doc IDs look like placeIds
            const sampleIds = [];
            fullSnap.forEach(doc => { if (sampleIds.length < 5) sampleIds.push(doc.id); });
            console.log(`\nSample doc IDs: ${sampleIds.join(', ')}`);

            // Check overlap with alert placeIds
            const alertsSnap = await db.collection('alerts').limit(100).get();
            const sampleAlertPlaceIds = new Set();
            alertsSnap.forEach(doc => {
                (doc.data().places || []).forEach(p => { if (p.placeId) sampleAlertPlaceIds.add(p.placeId); });
            });

            let matchById = 0;
            let matchByField = 0;
            fullSnap.forEach(doc => {
                if (sampleAlertPlaceIds.has(doc.id)) matchById++;
                const d = doc.data();
                if (d.placeId && sampleAlertPlaceIds.has(d.placeId)) matchByField++;
                if (d.place_id && sampleAlertPlaceIds.has(d.place_id)) matchByField++;
            });
            console.log(`Matches by doc ID with first 100 alerts' placeIds: ${matchById}`);
            console.log(`Matches by placeId field: ${matchByField}`);
        } else {
            console.log(`Collection "${name}" — empty or does not exist`);
        }
    }

    // Also check users collection for pro users with centre data (placeId)
    console.log('\n=== Checking pro users for place_id data ===');
    const prosSnap = await db.collection('users').where('type', 'in', ['pro', 'super_pro']).limit(3).get();
    console.log(`Pro users found (sample): ${prosSnap.size}`);
    prosSnap.forEach(doc => {
        const d = doc.data();
        const centreFields = Object.keys(d).filter(k => k.startsWith('centre_'));
        console.log(`\nPro ${doc.id}:`);
        centreFields.forEach(k => {
            const v = d[k];
            if (v && typeof v === 'object' && v._latitude !== undefined) {
                console.log(`  ${k}: GeoPoint(${v._latitude}, ${v._longitude})`);
            } else {
                console.log(`  ${k}: ${JSON.stringify(v)}`);
            }
        });
        if (d.centre_place_id) console.log(`  ** centre_place_id: ${d.centre_place_id}`);
    });

    process.exit(0);
}

findCentres().catch(err => { console.error(err); process.exit(1); });
