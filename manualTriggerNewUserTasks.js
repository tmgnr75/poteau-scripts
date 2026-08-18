const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// ---------------- INIT FIREBASE ----------------
console.log('[INIT] Starting Firebase Admin with project:', PROJECT_ID);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// ---------------- MAIN SCRIPT ----------------
(async () => {
    try {
        console.log('[START] Fetching user docs and returning fixed values');

        const userIds = [
            '67Psw8X79FMUjsovtgnUjQ63oRE2',
            '1ebhOJIOF5h4ba8BBMr72kmKQZq1',
            'C50BqTMTkEZJ87jW3rkTIxNJFr52',
            'XUmKXoaMf1MTi1iYK8LSvUp8nvQ2',
            'AftWyfbfWWQQiodQc6CHlq9moVx2',
        ];

        console.log(`[INFO] Total user IDs to query: ${userIds.length}`);
        console.log('[INFO] User IDs:', userIds);

        const results = [];

        for (const userId of userIds) {
            console.log(`\n[QUERY] Fetching user document with ID: ${userId}`);

            const docRef = db.collection('users').doc(userId);
            const docSnap = await docRef.get();

            if (!docSnap.exists) {
                console.warn(`[WARN] No document found for user ID: ${userId}`);
                continue;
            }

            console.log(`[SUCCESS] Document found for user ID: ${userId}`);
            console.log('[ACTION] Assigning fixed values country_code="FR", language="fr"');

            const entry = {
                country_code: 'FR',
                language: 'fr',
            };

            results.push(entry);
            console.log(`[RESULT] Assigned for ${userId}:`, entry);
        }

        console.log('\n[FINAL] Aggregated results (array only):');
        console.log(JSON.stringify(results, null, 2));

        console.log('[DONE] Script finished successfully');
        process.exit(0);
    } catch (error) {
        console.error('[ERROR] Script failed:', error);
        process.exit(1);
    }
})();