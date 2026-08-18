const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function extractAttendees(centreName, outputFile) {
    console.log(`\nQuerying games for centre: "${centreName}" with status=played and type=pro...`);

    const gamesSnapshot = await db.collection('games')
        .where('centre', '==', centreName)
        .where('status', '==', 'played')
        .where('type', '==', 'pro')
        .get();

    console.log(`Found ${gamesSnapshot.size} games.`);

    // Collect unique user IDs from attendees
    const userIds = new Set();

    for (const gameDoc of gamesSnapshot.docs) {
        const data = gameDoc.data();
        const attendees = data.attendees || [];
        for (const ref of attendees) {
            if (ref && ref.id) {
                userIds.add(ref.id);
            }
        }
    }

    console.log(`Found ${userIds.size} unique users across all games.`);

    // Fetch user docs
    const userIdsArray = Array.from(userIds);
    const rows = [];

    // Batch fetches in groups of 10 (Firestore getAll limit)
    const batchSize = 10;
    for (let i = 0; i < userIdsArray.length; i += batchSize) {
        const batch = userIdsArray.slice(i, i + batchSize);
        const refs = batch.map(id => db.collection('users').doc(id));
        const docs = await db.getAll(...refs);

        for (const doc of docs) {
            if (doc.exists) {
                const d = doc.data();
                const displayName = (d.display_name || '').replace(/,/g, ' ');
                const phoneNumber = (d.phone_number || '').replace(/,/g, ' ');
                if (displayName || phoneNumber) {
                    rows.push({ displayName, phoneNumber });
                }
            }
        }
    }

    // Sort by display name
    rows.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Write CSV - WhatsApp-friendly format (phone numbers ready to add)
    const csv = 'display_name,phone_number\n' +
        rows.map(r => `${r.displayName},${r.phoneNumber}`).join('\n');

    fs.writeFileSync(outputFile, csv, 'utf-8');
    console.log(`Exported ${rows.length} users to ${outputFile}`);
}

async function main() {
    try {
        await extractAttendees('IMPULSTAR PARK', './exports/impulstar_park_attendees.csv');
        await extractAttendees('Foot-Max Argenteuil', './exports/footmax_argenteuil_attendees.csv');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        admin.app().delete();
    }
}

main();
