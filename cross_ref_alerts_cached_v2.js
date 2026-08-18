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
    // 1. Get all unique placeIds from alerts (with centre names)
    const alertsSnap = await db.collection('alerts').get();
    const alertPlaceIds = new Map(); // placeId -> { count, name }
    alertsSnap.forEach(doc => {
        (doc.data().places || []).forEach(p => {
            if (p.placeId) {
                const existing = alertPlaceIds.get(p.placeId) || { count: 0, name: p.centre };
                existing.count++;
                alertPlaceIds.set(p.placeId, existing);
            }
        });
    });
    console.log(`Unique placeIds from alerts: ${alertPlaceIds.size}`);

    // 2. Get all cached_centres (doc ID = placeId)
    const cachedSnap = await db.collection('cached_centres').get();
    const cachedIds = new Set();
    let withLocation = 0;
    let withoutLocation = 0;

    cachedSnap.forEach(doc => {
        cachedIds.add(doc.id);
        const d = doc.data();
        if (d.centre_location) withLocation++;
        else withoutLocation++;
    });
    console.log(`Total cached_centres: ${cachedSnap.size} (${withLocation} with location, ${withoutLocation} without)`);

    // 3. Cross-reference
    let found = 0;
    let foundWithLoc = 0;
    let missing = 0;
    const missingTopExamples = [];

    for (const [placeId, info] of alertPlaceIds) {
        if (cachedIds.has(placeId)) {
            found++;
            // Check if it has location
            foundWithLoc++; // all cached_centres seem to have location based on samples
        } else {
            missing++;
            missingTopExamples.push({ placeId, name: info.name, alertCount: info.count });
        }
    }

    // Sort missing by alert count (most impactful first)
    missingTopExamples.sort((a, b) => b.alertCount - a.alertCount);

    console.log(`\n=== RESULTS ===`);
    console.log(`Alert placeIds found in cached_centres: ${found} (${(found / alertPlaceIds.size * 100).toFixed(1)}%)`);
    console.log(`Alert placeIds MISSING: ${missing} (${(missing / alertPlaceIds.size * 100).toFixed(1)}%)`);

    // How many alert DOCS are covered vs not
    let coveredAlertRefs = 0;
    let uncoveredAlertRefs = 0;
    for (const [placeId, info] of alertPlaceIds) {
        if (cachedIds.has(placeId)) coveredAlertRefs += info.count;
        else uncoveredAlertRefs += info.count;
    }
    console.log(`\nAlert-place references covered: ${coveredAlertRefs} / ${coveredAlertRefs + uncoveredAlertRefs} (${(coveredAlertRefs / (coveredAlertRefs + uncoveredAlertRefs) * 100).toFixed(1)}%)`);

    console.log(`\nTop 20 MISSING placeIds (by alert count):`);
    missingTopExamples.slice(0, 20).forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.name} (${ex.placeId}) — ${ex.alertCount} alerts`);
    });

    // Distribution of missing by alert count
    const missingWith1 = missingTopExamples.filter(e => e.alertCount === 1).length;
    const missingWith2to5 = missingTopExamples.filter(e => e.alertCount >= 2 && e.alertCount <= 5).length;
    const missingWith6plus = missingTopExamples.filter(e => e.alertCount >= 6).length;
    console.log(`\nMissing placeIds distribution:`);
    console.log(`  1 alert: ${missingWith1}`);
    console.log(`  2-5 alerts: ${missingWith2to5}`);
    console.log(`  6+ alerts: ${missingWith6plus}`);

    process.exit(0);
}

crossRef().catch(err => { console.error(err); process.exit(1); });
