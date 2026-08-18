const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Target centres and placeIds
const TARGET_CENTRES = ['Soctainer', 'Soccer Complex'];
const TARGET_PLACE_IDS = [
    'ChIJt-kZfv622YgR4PrDZCA7JCw',
    'ChIJ3YEPnnax2YgROwtR5SNJvtE'
];

// CSV Writer setup
const csvWriter = createCsvWriter({
    path: `exports/us_alerts_users_${Date.now()}.csv`,
    header: [
        { id: 'user_id', title: 'user_id' },
        { id: 'display_name', title: 'display_name' },
        { id: 'phone_number', title: 'phone_number' },
        { id: 'email', title: 'email' },
        { id: 'last_address', title: 'last_address' },
        { id: 'created_time', title: 'created_time' },
        { id: 'last_activity_date', title: 'last_activity_date' },
        { id: 'last_played_date', title: 'last_played_date' },
        { id: 'last_organized_date', title: 'last_organized_date' },
        { id: 'language', title: 'language' },
        { id: 'country_code', title: 'country_code' },
        { id: 'app_version', title: 'app_version' },
        { id: 'count_alerts', title: 'count_alerts' }
    ],
    encoding: 'utf-8'
});

// Helper to format Firestore timestamp to standard format
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate();
        return date.toISOString();
    } catch (e) {
        return '';
    }
}

// Helper to format date as YYYY-MM-DD only
function formatDateOnly(timestamp) {
    if (!timestamp) return '';
    try {
        const date = timestamp.toDate();
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
    } catch (e) {
        return '';
    }
}

// Check if an alert matches our criteria
function alertMatchesCriteria(alertData) {
    if (!alertData.places || !Array.isArray(alertData.places)) {
        return false;
    }

    return alertData.places.some(place => {
        const centreMatches = place.centre && TARGET_CENTRES.some(target =>
            place.centre.includes(target)
        );
        const placeIdMatches = place.placeId && TARGET_PLACE_IDS.some(target =>
            place.placeId.includes(target)
        );
        return centreMatches || placeIdMatches;
    });
}

async function main() {
    try {
        const userIds = new Set();

        // Step 1: Get all alerts and filter for matching criteria
        console.log('Fetching alerts...');
        const alertsSnapshot = await db.collection('alerts').get();

        let matchingAlertsCount = 0;
        alertsSnapshot.forEach(doc => {
            const data = doc.data();
            if (alertMatchesCriteria(data)) {
                userIds.add(doc.id); // Alert doc ID is the user ID
                matchingAlertsCount++;
            }
        });
        console.log(`Found ${matchingAlertsCount} alerts matching criteria (${userIds.size} unique users)`);

        // Step 2: Get all users with country_code = 'US'
        console.log('Fetching US users...');
        const usUsersSnapshot = await db.collection('users')
            .where('country_code', '==', 'US')
            .get();

        usUsersSnapshot.forEach(doc => {
            userIds.add(doc.id);
        });
        console.log(`Found ${usUsersSnapshot.size} US users`);
        console.log(`Total unique users to export: ${userIds.size}`);

        // Step 3: Fetch all user documents and their alerts
        console.log('Fetching user details...');
        const records = [];
        const userIdArray = Array.from(userIds);

        // Process in batches of 10 for Firestore limits
        const batchSize = 10;
        for (let i = 0; i < userIdArray.length; i += batchSize) {
            const batch = userIdArray.slice(i, i + batchSize);

            const userPromises = batch.map(async (userId) => {
                const userDoc = await db.collection('users').doc(userId).get();
                const alertDoc = await db.collection('alerts').doc(userId).get();

                if (!userDoc.exists) {
                    console.log(`User ${userId} not found in users collection`);
                    return null;
                }

                const userData = userDoc.data();
                const alertData = alertDoc.exists ? alertDoc.data() : null;

                // Count alerts (number of items in alerts array, which is 'places' in this case)
                let countAlerts = 0;
                if (alertData && alertData.places && Array.isArray(alertData.places)) {
                    countAlerts = alertData.places.length;
                }

                return {
                    user_id: userId,
                    display_name: userData.display_name || '',
                    phone_number: userData.phone_number || '',
                    email: userData.email || '',
                    last_address: userData.last_address || '',
                    created_time: formatTimestamp(userData.created_time),
                    last_activity_date: formatDateOnly(userData.last_activity_date),
                    last_played_date: formatTimestamp(userData.last_played_date),
                    last_organized_date: formatTimestamp(userData.last_organized_date),
                    language: userData.language || '',
                    country_code: userData.country_code || '',
                    app_version: userData.app_version || '',
                    count_alerts: countAlerts
                };
            });

            const batchResults = await Promise.all(userPromises);
            records.push(...batchResults.filter(r => r !== null));

            if ((i + batchSize) % 100 === 0 || i + batchSize >= userIdArray.length) {
                console.log(`Processed ${Math.min(i + batchSize, userIdArray.length)}/${userIdArray.length} users`);
            }
        }

        // Step 4: Write to CSV
        console.log(`Writing ${records.length} records to CSV...`);
        await csvWriter.writeRecords(records);
        console.log('CSV file was written successfully');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();
