const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Configuration - centres to filter by (Google Places IDs)
const TARGET_PLACE_IDS = [
    'ChIJt-kZfv622YgR4PrDZCA7JCw',  // Soctainer / Soctainer Miami
    'ChIJ3YEPnnax2YgROwtR5SNJvtE'   // Soccer Complex Miami / Soccer Complex
];

// Calculate 30 days ago
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

// Format date as dd/mm/yyyy
function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : date.toDate();
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

async function main() {
    console.log('Fetching alerts...');

    // Get all alerts
    const alertsSnapshot = await db.collection('alerts').get();
    console.log(`Found ${alertsSnapshot.size} total alerts`);

    // Use Set to collect unique user IDs
    const uniqueUserIds = new Set();

    alertsSnapshot.forEach(doc => {
        const data = doc.data();

        // Check if any place in the alert matches our target placeIds
        if (data.places && Array.isArray(data.places)) {
            const hasMatchingPlace = data.places.some(place =>
                TARGET_PLACE_IDS.includes(place.placeId)
            );

            if (hasMatchingPlace && data.user) {
                // Extract user ID from the DocumentReference
                const userId = data.user.id || data.user.path.split('/').pop();
                uniqueUserIds.add(userId);
            }
        }
    });

    console.log(`Found ${uniqueUserIds.size} unique users with alerts for target centres`);

    if (uniqueUserIds.size === 0) {
        console.log('No matching users found. Exiting.');
        process.exit(0);
    }

    // Fetch user details for matching users
    console.log('Fetching user details...');
    const records = new Map(); // Use Map to ensure uniqueness by email

    for (const userId of uniqueUserIds) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();

            if (!userDoc.exists) {
                console.log(`User ${userId} not found in users collection`);
                continue;
            }

            const userData = userDoc.data();

            // Check if user was active in the last 30 days
            const lastActivityDate = userData.last_activity_date?.toDate();

            if (!lastActivityDate || lastActivityDate < thirtyDaysAgo) {
                continue; // Skip users not active in last 30 days
            }

            const email = userData.email || '';

            // Use email as key to ensure uniqueness (skip if already added)
            if (email && !records.has(email)) {
                records.set(email, {
                    display_name: userData.display_name || '',
                    email: email,
                    phone: userData.phone_number || '',
                    last_address: userData.last_address || '',
                    created_time: formatDate(userData.created_time),
                    last_activity_date: formatDate(userData.last_activity_date)
                });
            } else if (!email) {
                // If no email, use userId as key
                records.set(userId, {
                    display_name: userData.display_name || '',
                    email: '',
                    phone: userData.phone_number || '',
                    last_address: userData.last_address || '',
                    created_time: formatDate(userData.created_time),
                    last_activity_date: formatDate(userData.last_activity_date)
                });
            }
        } catch (error) {
            console.error(`Error fetching user ${userId}:`, error.message);
        }
    }

    const recordsArray = Array.from(records.values());
    console.log(`Found ${recordsArray.length} unique users active in the last 30 days`);

    if (recordsArray.length === 0) {
        console.log('No active users found. Exiting.');
        process.exit(0);
    }

    // Write to CSV
    const csvWriter = createCsvWriter({
        path: `exports/alerts_by_centres_${Date.now()}.csv`,
        header: [
            { id: 'display_name', title: 'DISPLAY_NAME' },
            { id: 'email', title: 'EMAIL' },
            { id: 'phone', title: 'PHONE' },
            { id: 'last_address', title: 'LAST_ADDRESS' },
            { id: 'created_time', title: 'CREATED_TIME' },
            { id: 'last_activity_date', title: 'LAST_ACTIVITY_DATE' }
        ],
        encoding: 'utf-8'
    });

    await csvWriter.writeRecords(recordsArray);
    console.log(`CSV file written successfully with ${recordsArray.length} records`);
    process.exit(0);
}

main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
});
