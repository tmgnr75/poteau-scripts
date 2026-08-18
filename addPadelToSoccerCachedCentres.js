/**
 * Append "padel" to sports array for specific cached_centres docs
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// List of doc IDs to update
const targetIds = [
    'ChIJ-eisyafYtRIRV-06tEm2VTo',
    'ChIJ-eyETc2ckUcRBWEN6LGV_u0',
    'ChIJE9ZciNLHlkcRF9bBiXbLuYk',
    'ChIJFZU5oBHC9EcRJTFrSkI1xxg',
    'ChIJJdTQjr0T5kcRZmGxtIJVy44',
    'ChIJR3ro5nTWwkcRfM_S3Be9HjI',
    'ChIJVc4JI-FtjEcRkBpWIDCVoII',
    'ChIJZdrYy1D-yRIRrrlLXLwuv5Y',
    'ChIJeSnd96VNjUcRMB1eWaVkmKs',
    'ChIJfWQYaM9v6kcR5wfQjFQqpv4',
    'ChIJoTqB5CJmkUcRheYL3WcGzXo',
    'ChIJoUEDcmvr9EcRILCz6hDCQ2o',
    'ChIJodpwmbLblEcRGk4-_FQorf4',
    'ChIJsb_7TJFp5kcRSPL5VqZulr4',
];

(async () => {
    console.log(`\n[INIT] Updating ${targetIds.length} cached_centres docs to add "padel"`);

    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const id of targetIds) {
        const ref = db.collection('cached_centres').doc(id);

        try {
            const doc = await ref.get();
            if (!doc.exists) {
                console.warn(`[SKIP] Doc not found: ${id}`);
                skipped++;
                continue;
            }

            const data = doc.data();
            const sports = Array.isArray(data.sports) ? [...data.sports] : [];

            if (!sports.includes('padel')) {
                sports.push('padel');
                await ref.update({ sports });
                console.log(`[UPDATE ✅] ${id} -> sports: [${sports.join(', ')}]`);
                success++;
            } else {
                console.log(`[SKIP ✅] ${id} already includes "padel"`);
                skipped++;
            }
        } catch (err) {
            console.error(`[ERROR ❌] ${id}: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n[SUMMARY] ✅ ${success} updated | ⏭️ ${skipped} skipped | ❌ ${failed} failed`);
    console.log('[DONE] "padel" successfully added to selected cached_centres docs where missing.');
})();