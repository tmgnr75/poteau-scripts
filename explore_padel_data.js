const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function explore() {
    try {
        // 1. Check case sensitivity for sport field
        console.log('=== CHECKING SPORT FIELD VALUES ===\n');

        const lowerSnap = await db.collection('games').where('sport', '==', 'padel').limit(3).get();
        console.log(`Games with sport == "padel": ${lowerSnap.size}`);

        const upperSnap = await db.collection('games').where('sport', '==', 'Padel').limit(3).get();
        console.log(`Games with sport == "Padel": ${upperSnap.size}`);

        const capsSnap = await db.collection('games').where('sport', '==', 'PADEL').limit(3).get();
        console.log(`Games with sport == "PADEL": ${capsSnap.size}`);

        // Determine which one has data
        let sportValue = 'padel';
        if (upperSnap.size > lowerSnap.size) sportValue = 'Padel';
        if (capsSnap.size > Math.max(lowerSnap.size, upperSnap.size)) sportValue = 'PADEL';
        console.log(`\nUsing sport value: "${sportValue}"\n`);

        // 2. Get 10 sample padel games
        console.log('=== 10 SAMPLE PADEL GAMES ===\n');

        const gamesSnap = await db.collection('games').where('sport', '==', sportValue).limit(10).get();
        console.log(`Found ${gamesSnap.size} sample games\n`);

        for (const doc of gamesSnap.docs) {
            const data = doc.data();
            console.log(`--- Game ${doc.id} ---`);
            console.log('Fields:', Object.keys(data).sort().join(', '));
            console.log('Full data:');

            // Print each field with type info
            for (const [key, value] of Object.entries(data)) {
                let displayValue = value;
                let typeStr = typeof value;

                if (value === null) {
                    typeStr = 'null';
                    displayValue = 'null';
                } else if (value instanceof admin.firestore.Timestamp) {
                    typeStr = 'Timestamp';
                    displayValue = value.toDate().toISOString();
                } else if (value instanceof admin.firestore.DocumentReference) {
                    typeStr = 'DocumentReference';
                    displayValue = value.path;
                } else if (value instanceof admin.firestore.GeoPoint) {
                    typeStr = 'GeoPoint';
                    displayValue = `(${value.latitude}, ${value.longitude})`;
                } else if (Array.isArray(value)) {
                    typeStr = 'Array';
                    if (value.length > 0 && value[0] instanceof admin.firestore.DocumentReference) {
                        displayValue = `[${value.length} DocumentReferences: ${value.map(r => r.path).join(', ')}]`;
                    } else {
                        displayValue = JSON.stringify(value);
                    }
                } else if (typeof value === 'object') {
                    typeStr = 'Object';
                    displayValue = JSON.stringify(value);
                }

                console.log(`  ${key} (${typeStr}): ${displayValue}`);
            }
            console.log('');
        }

        // 3. Count total padel games
        console.log('=== TOTAL PADEL GAMES COUNT ===\n');
        const allPadelSnap = await db.collection('games').where('sport', '==', sportValue).get();
        console.log(`Total padel games: ${allPadelSnap.size}`);

        // Count by status
        const statusCounts = {};
        allPadelSnap.forEach(doc => {
            const status = doc.data().status || 'unknown';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        console.log('By status:', JSON.stringify(statusCounts, null, 2));

        // 4. Check repeaters for padel
        console.log('\n=== PADEL REPEATERS ===\n');

        const repSnap1 = await db.collection('repeaters').where('sport', '==', 'padel').get();
        console.log(`Repeaters with sport == "padel": ${repSnap1.size}`);

        const repSnap2 = await db.collection('repeaters').where('sport', '==', 'Padel').get();
        console.log(`Repeaters with sport == "Padel": ${repSnap2.size}`);

        const repSnap3 = await db.collection('repeaters').where('sport', '==', 'soccer').get();
        console.log(`(For reference) Repeaters with sport == "soccer": ${repSnap3.size}`);

        const repeaterSnap = repSnap1.size > 0 ? repSnap1 : repSnap2;

        if (repeaterSnap.size > 0) {
            console.log('\nSample repeaters:');
            repeaterSnap.docs.slice(0, 5).forEach(doc => {
                const data = doc.data();
                console.log(`\n--- Repeater ${doc.id} ---`);
                console.log('Fields:', Object.keys(data).sort().join(', '));
                for (const [key, value] of Object.entries(data)) {
                    let displayValue = value;
                    if (value instanceof admin.firestore.Timestamp) {
                        displayValue = value.toDate().toISOString();
                    } else if (value instanceof admin.firestore.DocumentReference) {
                        displayValue = value.path;
                    } else if (typeof value === 'object' && value !== null) {
                        displayValue = JSON.stringify(value);
                    }
                    console.log(`  ${key}: ${displayValue}`);
                }
            });
        }

        // 5. Check a few organizers to see pro vs player differences
        console.log('\n=== ORGANIZER TYPES ===\n');

        const organizerIds = new Set();
        gamesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.organizer) {
                if (typeof data.organizer === 'string') {
                    organizerIds.add(data.organizer);
                } else if (data.organizer instanceof admin.firestore.DocumentReference) {
                    organizerIds.add(data.organizer.id);
                }
            }
        });

        for (const uid of organizerIds) {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const u = userDoc.data();
                console.log(`User ${uid}: type=${u.type}, display_name=${u.display_name}, centre_name=${u.centre_name || 'N/A'}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await admin.app().delete();
    }
}

explore();
