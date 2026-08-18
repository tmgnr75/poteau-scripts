/****
 * Export current cached_centres data to centres_export.csv
 */

const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
    const collectionName = 'cached_centres';
    const outputFile = './centres_export.csv';
    console.log(`\n[INIT] Starting export for collection "${collectionName}" in project ${PROJECT_ID}`);

    const snapshot = await db.collection(collectionName).get();
    console.log(`[FETCH] Retrieved ${snapshot.size} documents from ${collectionName}`);

    const rows = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const id = doc.id;

        // Build export row
        rows.push({
            centre_place_id: data.centre_place_id || id,
            centre_name: data.centre_name || '',
            sports: (data.sports || []).join(','),
        });
    }

    // Export CSV
    const header = 'centre_place_id,centre_name,sports\n';
    const body = rows.map(r => `${r.centre_place_id},"${r.centre_name}",${r.sports}`).join('\n');
    // Add UTF-8 BOM to ensure correct display of accented characters in Excel
    fs.writeFileSync(outputFile, '\uFEFF' + header + body, { encoding: 'utf8' });

    console.log(`\n[EXPORT] Saved ${rows.length} rows to ${outputFile}`);
    console.log('[DONE] Export completed. You can now open centres_export.csv to view the data.');
})();