const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();
const ORGANIZER_ID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';

async function run() {
    // 1. Get all games organized by this user (try both string and reference)
    const gamesSnapString = await db.collection('games')
        .where('organizer', '==', ORGANIZER_ID)
        .get();

    const userRef = db.collection('users').doc(ORGANIZER_ID);
    const gamesSnapRef = await db.collection('games')
        .where('organizer', '==', userRef)
        .get();

    // Also check centreRef pointing to this user (some games use centreRef as organizer link)
    const gamesSnapCentre = await db.collection('games')
        .where('centreRef', '==', userRef)
        .get();

    // Deduplicate games by ID
    const gamesMap = new Map();
    for (const doc of gamesSnapString.docs) gamesMap.set(doc.id, doc);
    for (const doc of gamesSnapRef.docs) gamesMap.set(doc.id, doc);
    for (const doc of gamesSnapCentre.docs) gamesMap.set(doc.id, doc);

    const allGames = Array.from(gamesMap.values());

    console.log(`Found ${gamesSnapString.size} games (organizer as string)`);
    console.log(`Found ${gamesSnapRef.size} games (organizer as ref)`);
    console.log(`Found ${gamesSnapCentre.size} games (centreRef as ref)`);
    console.log(`Total unique games: ${allGames.length}\n`);

    // Print game details
    for (const gameDoc of allGames) {
        const d = gameDoc.data();
        const date = d.date ? (d.date.toDate ? d.date.toDate().toISOString().slice(0, 10) : d.date) : 'N/A';
        const status = d.status || 'N/A';
        const sport = d.sport || 'N/A';
        const attendeeCount = (d.attendees || []).length;
        console.log(`  Game ${gameDoc.id} | ${date} | ${sport} | ${status} | ${attendeeCount} attendees`);
    }

    // 2. Collect all unique attendee user IDs
    const attendeeIds = new Set();

    for (const gameDoc of allGames) {
        const data = gameDoc.data();
        const attendees = data.attendees || [];
        for (const att of attendees) {
            // attendees can be references or strings
            if (att && att.id) {
                attendeeIds.add(att.id);
            } else if (typeof att === 'string') {
                attendeeIds.add(att);
            } else if (att && att.path) {
                const parts = att.path.split('/');
                attendeeIds.add(parts[parts.length - 1]);
            }
        }
    }

    console.log(`Found ${attendeeIds.size} unique attendees\n`);

    // 3. Fetch user details for each attendee
    const results = [];

    for (const uid of attendeeIds) {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const u = userDoc.data();
                results.push({
                    userId: uid,
                    displayName: u.display_name || u.displayName || '',
                    phoneNumber: u.phone_number || u.phoneNumber || '',
                    email: u.email || '',
                    lastActivityDate: u.last_activity_date
                        ? (u.last_activity_date.toDate ? u.last_activity_date.toDate().toISOString() : u.last_activity_date)
                        : 'N/A',
                });
            } else {
                results.push({
                    userId: uid,
                    displayName: '(user not found)',
                    phoneNumber: '',
                    email: '',
                    lastActivityDate: 'N/A',
                });
            }
        } catch (err) {
            console.error(`Error fetching user ${uid}:`, err.message);
        }
    }

    // 4. Sort by display name and print
    results.sort((a, b) => a.displayName.localeCompare(b.displayName));

    console.log('='.repeat(120));
    console.log(
        'User ID'.padEnd(30) +
        'Display Name'.padEnd(25) +
        'Phone'.padEnd(20) +
        'Email'.padEnd(30) +
        'Last Activity'
    );
    console.log('='.repeat(120));

    for (const r of results) {
        console.log(
            r.userId.padEnd(30) +
            r.displayName.padEnd(25) +
            r.phoneNumber.padEnd(20) +
            r.email.padEnd(30) +
            r.lastActivityDate
        );
    }

    console.log('='.repeat(120));
    console.log(`\nTotal unique attendees: ${results.length}`);

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
