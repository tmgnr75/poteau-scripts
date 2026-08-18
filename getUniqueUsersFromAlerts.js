const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

/**
 * Fetch unique users from alerts based on given criteria
 * @param {string} placeName - The name of the place to filter
 * @param {number} weekday - The weekday to filter (1 = Monday, ..., 7 = Sunday)
 * @param {string} time - The time to filter (e.g., "18:00")
 * @returns {Promise<Set<string>>} - Set of unique user document references
 */
async function getUniqueUsersFromAlerts(placeName) {
    console.log(`\n🚀 Querying Firestore -> Place: "${placeName}", Weekday: ${weekday}, Time: "${time}"\n`);

    try {
        // Firestore query: Filter by `time` (avoiding multiple ARRAY_CONTAINS)
        const alertsQuery = db.collection('alerts')
            // .where('times', 'array-contains', time);
        //   .where('weekday', 'array-contains', time);

        const alertsSnapshot = await alertsQuery.get();
        console.log(`🔍 Retrieved ${alertsSnapshot.size} matching alert documents from Firestore.\n`);

        const uniqueUsers = new Set();

        alertsSnapshot.forEach((doc) => {
            const alertData = doc.data();
            const alertId = doc.id;

            console.log(`📌 Processing alert document: ${alertId}`);

            // Validate required fields
            // if (!alertData.places || !alertData.weekdays || !alertData.user) {
            //     console.warn(`⚠️ Skipping alert ${alertId} due to missing fields.\n`);
            //     return;
            // }

            // // Check if the place exists in the places array (manual filter)
            const placeMatch = alertData.places.some((place) => place.centre === placeName);
            if (!placeMatch) {
                console.log(`❌ Alert ${alertId} does not match place "${placeName}". Skipping...\n`);
                return;
            }

            // // Check if the weekday exists in the weekdays array (manual filter)
            // if (!alertData.weekdays.includes(weekday)) {
            //     console.log(`❌ Alert ${alertId} does not match weekday ${weekday}. Skipping...\n`);
            //     return;
            // }

            // // Check if time exists in the times array (manual filter)
            // if (!alertData.times.includes(time)) {
            //     console.log(`❌ Alert ${alertId} does not match time ${time}. Skipping...\n`);
            //     return;
            // }

            // If all conditions match, add user reference to the unique set
            uniqueUsers.add(alertData.user.path);
            console.log(`✅ Matched alert ${alertId} -> User: ${alertData.user.path}\n`);
        });

        console.log(`🎯 Found ${uniqueUsers.size} unique users matching the criteria.\n`);
        return uniqueUsers;
    } catch (error) {
        console.error(`❌ Error fetching alerts: ${error.message}`);
        throw error;
    }
}

// Example usage
const placeName = "Soctainer Miami"; // Replace with actual input
const weekday = 7; // Replace with actual input (1 = Monday, 7 = Sunday)
const time = "10:00"; // Replace with actual input

getUniqueUsersFromAlerts(placeName)
    .then((uniqueUsers) => {
        console.log("📋 Final list of unique users:", Array.from(uniqueUsers));
    })
    .catch((error) => {
        console.error("❌ Failed to retrieve users:", error);
    });