const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function diagnoseAlerts() {
    console.log('=== ALERTS COLLECTION DIAGNOSTIC ===\n');

    // 1. Get total count
    const snapshot = await db.collection('alerts').get();
    console.log(`Total documents: ${snapshot.size}\n`);

    // 2. Analyze all documents
    const allDocs = [];
    const allFieldNames = new Set();
    const fieldTypeCounts = {};
    const timesFormats = new Set();
    const weekdayValues = new Set();
    const placesExamples = [];

    snapshot.forEach(doc => {
        const data = doc.data();
        const docInfo = { id: doc.id, ...data };
        allDocs.push(docInfo);

        // Collect all field names
        Object.keys(data).forEach(key => {
            allFieldNames.add(key);
            if (!fieldTypeCounts[key]) fieldTypeCounts[key] = { types: new Set(), count: 0 };
            fieldTypeCounts[key].count++;
            fieldTypeCounts[key].types.add(typeof data[key]);
        });

        // Analyze times format
        if (data.times && Array.isArray(data.times)) {
            data.times.forEach(t => timesFormats.add(t));
        }

        // Analyze weekdays
        if (data.weekdays && Array.isArray(data.weekdays)) {
            data.weekdays.forEach(w => weekdayValues.add(w));
        }

        // Collect places examples
        if (data.places && Array.isArray(data.places) && data.places.length > 0) {
            placesExamples.push({ docId: doc.id, places: data.places.slice(0, 2) });
        }
    });

    // 3. Print schema
    console.log('--- SCHEMA ---');
    allFieldNames.forEach(field => {
        const info = fieldTypeCounts[field];
        console.log(`  ${field}: present in ${info.count}/${snapshot.size} docs, types: [${[...info.types].join(', ')}]`);
    });

    // 4. Print times analysis
    console.log('\n--- TIMES VALUES (all unique) ---');
    const sortedTimes = [...timesFormats].sort();
    console.log(`  Unique time values: ${sortedTimes.length}`);
    console.log(`  Examples: ${sortedTimes.slice(0, 30).join(', ')}`);
    if (sortedTimes.length > 30) console.log(`  ... and ${sortedTimes.length - 30} more`);

    // 5. Print weekdays analysis
    console.log('\n--- WEEKDAYS VALUES ---');
    const sortedWeekdays = [...weekdayValues].sort((a, b) => a - b);
    console.log(`  Unique values: ${sortedWeekdays.join(', ')}`);

    // 6. Print places analysis
    console.log('\n--- PLACES STRUCTURE (first 5 examples) ---');
    placesExamples.slice(0, 5).forEach(ex => {
        console.log(`  Doc ${ex.docId}:`);
        ex.places.forEach(p => {
            console.log(`    ${JSON.stringify(p)}`);
        });
    });

    // 7. Print 10 sample documents (mix of recent and old)
    const sorted = allDocs
        .filter(d => d.created)
        .sort((a, b) => {
            const dateA = a.created.toDate ? a.created.toDate() : new Date(a.created);
            const dateB = b.created.toDate ? b.created.toDate() : new Date(b.created);
            return dateB - dateA;
        });

    console.log('\n--- 5 MOST RECENT DOCUMENTS ---');
    sorted.slice(0, 5).forEach(doc => {
        const created = doc.created.toDate ? doc.created.toDate() : doc.created;
        console.log(`\n  ID: ${doc.id}`);
        console.log(`  created: ${created}`);
        console.log(`  user: ${doc.user ? doc.user.path : 'N/A'}`);
        console.log(`  weekdays: ${JSON.stringify(doc.weekdays)}`);
        console.log(`  times: ${JSON.stringify(doc.times)}`);
        console.log(`  places: ${JSON.stringify(doc.places)}`);
        // Print any extra fields
        const knownFields = ['created', 'user', 'weekdays', 'times', 'places'];
        Object.keys(doc).filter(k => k !== 'id' && !knownFields.includes(k)).forEach(k => {
            console.log(`  [EXTRA] ${k}: ${JSON.stringify(doc[k])}`);
        });
    });

    console.log('\n--- 5 OLDEST DOCUMENTS ---');
    sorted.slice(-5).forEach(doc => {
        const created = doc.created.toDate ? doc.created.toDate() : doc.created;
        console.log(`\n  ID: ${doc.id}`);
        console.log(`  created: ${created}`);
        console.log(`  user: ${doc.user ? doc.user.path : 'N/A'}`);
        console.log(`  weekdays: ${JSON.stringify(doc.weekdays)}`);
        console.log(`  times: ${JSON.stringify(doc.times)}`);
        console.log(`  places: ${JSON.stringify(doc.places)}`);
    });

    // 8. Inconsistencies
    console.log('\n--- INCONSISTENCIES ---');
    let docsWithoutUser = 0;
    let docsWithoutTimes = 0;
    let docsWithoutWeekdays = 0;
    let docsWithoutPlaces = 0;
    let docsWithEmptyTimes = 0;
    let docsWithEmptyWeekdays = 0;
    let docsWithEmptyPlaces = 0;

    allDocs.forEach(doc => {
        if (!doc.user) docsWithoutUser++;
        if (!doc.times) docsWithoutTimes++;
        else if (doc.times.length === 0) docsWithEmptyTimes++;
        if (!doc.weekdays) docsWithoutWeekdays++;
        else if (doc.weekdays.length === 0) docsWithEmptyWeekdays++;
        if (!doc.places) docsWithoutPlaces++;
        else if (doc.places.length === 0) docsWithEmptyPlaces++;
    });

    console.log(`  Docs without user: ${docsWithoutUser}`);
    console.log(`  Docs without times: ${docsWithoutTimes} (empty array: ${docsWithEmptyTimes})`);
    console.log(`  Docs without weekdays: ${docsWithoutWeekdays} (empty array: ${docsWithEmptyWeekdays})`);
    console.log(`  Docs without places: ${docsWithoutPlaces} (empty array: ${docsWithEmptyPlaces})`);

    // 9. Stats on places count per alert
    const placeCounts = allDocs.map(d => (d.places || []).length);
    const avgPlaces = placeCounts.reduce((a, b) => a + b, 0) / placeCounts.length;
    const maxPlaces = Math.max(...placeCounts);
    console.log(`\n  Places per alert: avg=${avgPlaces.toFixed(1)}, max=${maxPlaces}`);

    const timeCounts = allDocs.map(d => (d.times || []).length);
    const avgTimes = timeCounts.reduce((a, b) => a + b, 0) / timeCounts.length;
    const maxTimes = Math.max(...timeCounts);
    console.log(`  Times per alert: avg=${avgTimes.toFixed(1)}, max=${maxTimes}`);

    const weekdayCounts = allDocs.map(d => (d.weekdays || []).length);
    const avgWeekdays = weekdayCounts.reduce((a, b) => a + b, 0) / weekdayCounts.length;
    console.log(`  Weekdays per alert: avg=${avgWeekdays.toFixed(1)}`);

    process.exit(0);
}

diagnoseAlerts().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
