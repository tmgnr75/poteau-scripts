const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

/**
 * Helper: format Firestore Timestamp to DD-MM-YYYY
 */
function formatDate(timestamp) {
    if (!timestamp) return null;
    const date = timestamp.toDate();
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const yyyy = date.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

(async () => {
    console.log("=======================================");
    console.log("[START] Fetching users created between Sept 7 and Sept 9, 2025 with connector apple/google");
    console.log("=======================================");

    try {
        // Define time boundaries
        const startDate = new Date('2025-09-07T00:00:00.000Z');
        const endDate = new Date('2025-09-09T00:00:00.000Z');
        console.log(`[INFO] Date boundaries: Start = ${startDate.toISOString()}, End = ${endDate.toISOString()}`);

        // Query users
        console.log("[INFO] Running Firestore query...");
        const snapshot = await db.collection('users')
            .where('created_time', '>=', startDate)
            .where('created_time', '<', endDate)
            .where('connector', 'in', ['apple', 'google'])
            .get();

        console.log(`[INFO] Query executed. Found ${snapshot.size} user(s).`);

        const results = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const formattedCreatedTime = formatDate(data.created_time);
            results.push({
                doc_id: doc.id,
                email: data.email || null,
                display_name: data.display_name || null,
                connector: data.connector || null,
                created_time: formattedCreatedTime
            });
            console.log(`[FOUND] User ${doc.id} | ${data.email} | ${data.display_name} | connector=${data.connector} | created_time=${formattedCreatedTime}`);
        });

        console.log("=======================================");
        console.log("[RESULT] Final JSON Output:");
        console.log(JSON.stringify(results, null, 2));
        console.log("=======================================");

        console.log(`[END] Successfully processed ${results.length} user(s).`);
    } catch (error) {
        console.error("[ERROR] Something went wrong during Firestore query:", error);
        process.exit(1);
    }
})();