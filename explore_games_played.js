const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function explore() {
    // Grab played games to see attendees structure
    const snapshot = await db.collection('games')
        .where('status', '==', 'played')
        .orderBy('date', 'desc')
        .limit(5)
        .get();

    console.log('=== PLAYED GAMES (attendees focus) ===\n');
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log('--- DOC ID:', doc.id, '---');
        console.log('  date:', data.date?.toDate().toISOString());
        console.log('  centre:', data.centre);
        console.log('  sport:', data.sport);
        console.log('  max_players:', data.max_players);
        console.log('  status:', data.status);

        // Focus on attendees
        if (data.attendees) {
            console.log('  attendees type:', typeof data.attendees, Array.isArray(data.attendees) ? `Array[${data.attendees.length}]` : '');
            if (Array.isArray(data.attendees)) {
                data.attendees.slice(0, 3).forEach((a, i) => {
                    if (a instanceof admin.firestore.DocumentReference) {
                        console.log(`    [${i}] DocumentReference: ${a.path}`);
                    } else if (typeof a === 'string') {
                        console.log(`    [${i}] string: ${a}`);
                    } else if (typeof a === 'object') {
                        console.log(`    [${i}] object:`, JSON.stringify(a));
                    }
                });
            }
        } else {
            console.log('  attendees: MISSING');
        }

        console.log('  ALL FIELDS:', Object.keys(data).join(', '));
        console.log('');
    });

    // Count by status
    for (const status of ['published', 'played', 'canceled', 'hidden']) {
        const snap = await db.collection('games').where('status', '==', status).count().get();
        console.log(`Status "${status}": ${snap.data().count}`);
    }

    process.exit(0);
}

explore().catch(e => { console.error(e); process.exit(1); });
