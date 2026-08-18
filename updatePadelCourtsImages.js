const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Initialize Firebase Admin
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Configuration
const CSV_FILE_PATH = path.join(__dirname, 'padel_courts_to_import.csv');
const COLLECTION_NAME = 'cached_centres';
const BATCH_SIZE = 500; // Firestore batch write limit

// Statistics tracking
const stats = {
    totalRows: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    skippedRows: 0,
    errors: []
};

/**
 * Validates a CSV row to ensure required fields are present
 */
function validateRow(row, rowNumber) {
    if (!row['Place Id'] || row['Place Id'].trim() === '') {
        console.warn(`[WARN] Row ${rowNumber}: Missing Place Id`);
        return false;
    }

    if (!row['Image'] || row['Image'].trim() === '') {
        console.warn(`[WARN] Row ${rowNumber}: Missing Image URL`);
        return false;
    }

    return true;
}

/**
 * Updates documents in Firestore in batches
 */
async function updateBatch(updates) {
    const batch = db.batch();

    console.log(`[BATCH] Preparing batch of ${updates.length} updates...`);

    for (const update of updates) {
        const docRef = db.collection(COLLECTION_NAME).doc(update.placeId);
        batch.update(docRef, { centre_image: update.imageUrl });
    }

    try {
        await batch.commit();
        console.log(`[SUCCESS] Successfully updated ${updates.length} documents`);
        stats.successfulUpdates += updates.length;
    } catch (error) {
        console.error(`[ERROR] Error updating batch:`, error.message);
        stats.failedUpdates += updates.length;
        stats.errors.push({
            type: 'batch_update',
            message: error.message,
            documentsCount: updates.length
        });
        throw error;
    }
}

/**
 * Main update function
 */
async function updatePadelCourtsImages() {
    console.log('[START] Padel Courts Image Update Process');
    console.log('============================================================');
    console.log(`[FILE] CSV File: ${CSV_FILE_PATH}`);
    console.log(`[COLLECTION] Collection: ${COLLECTION_NAME}`);
    console.log(`[CONFIG] Batch Size: ${BATCH_SIZE}`);
    console.log('============================================================');
    console.log('');

    // Check if CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`[ERROR] CSV file not found at ${CSV_FILE_PATH}`);
        process.exit(1);
    }

    console.log('[OK] CSV file found');
    console.log('');

    const updates = [];
    let rowNumber = 0;
    let headersLogged = false;

    return new Promise((resolve, reject) => {
        fs.createReadStream(CSV_FILE_PATH)
            .pipe(csv())
            .on('data', (row) => {
                rowNumber++;
                stats.totalRows++;

                // Debug: Log the first row headers to verify CSV parsing
                if (!headersLogged) {
                    console.log('[DEBUG] CSV Column Headers Found:');
                    console.log(Object.keys(row));
                    console.log('');
                    headersLogged = true;
                }

                // Log progress every 10 rows
                if (rowNumber % 10 === 0) {
                    console.log(`[PROGRESS] Processed ${rowNumber} rows...`);
                }

                // Validate the row
                if (!validateRow(row, rowNumber)) {
                    stats.skippedRows++;
                    return;
                }

                // Add to updates array
                try {
                    const placeId = row['Place Id'].trim();
                    const imageUrl = row['Image'].trim();

                    updates.push({
                        placeId: placeId,
                        imageUrl: imageUrl,
                        name: row['Name']?.trim() || 'Unknown'
                    });

                    console.log(`[OK] Row ${rowNumber}: ${updates[updates.length - 1].name} (${placeId})`);
                } catch (error) {
                    console.error(`[ERROR] Row ${rowNumber}: Error processing row:`, error.message);
                    stats.skippedRows++;
                    stats.errors.push({
                        type: 'processing',
                        row: rowNumber,
                        message: error.message
                    });
                }
            })
            .on('end', async () => {
                console.log('');
                console.log('============================================================');
                console.log('[COMPLETE] CSV parsing completed');
                console.log(`[STATS] Total rows read: ${stats.totalRows}`);
                console.log(`[STATS] Valid updates to process: ${updates.length}`);
                console.log(`[STATS] Skipped rows: ${stats.skippedRows}`);
                console.log('============================================================');
                console.log('');

                if (updates.length === 0) {
                    console.log('[WARN] No valid updates to process. Exiting.');
                    resolve();
                    return;
                }

                // Update documents in batches (will only update existing docs)
                console.log('[FIRESTORE] Starting batch updates...');
                console.log('');

                try {
                    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                        const batch = updates.slice(i, Math.min(i + BATCH_SIZE, updates.length));
                        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                        const totalBatches = Math.ceil(updates.length / BATCH_SIZE);

                        console.log(`[BATCH ${batchNumber}/${totalBatches}] Processing documents ${i + 1}-${i + batch.length}:`);
                        await updateBatch(batch);
                        console.log('');
                    }

                    resolve();
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', (error) => {
                console.error('[ERROR] Error reading CSV file:', error.message);
                reject(error);
            });
    });
}

/**
 * Prints final statistics
 */
function printStatistics() {
    console.log('');
    console.log('============================================================');
    console.log('[STATISTICS] UPDATE STATISTICS');
    console.log('============================================================');
    console.log(`Total rows processed:     ${stats.totalRows}`);
    console.log(`Successful updates:       ${stats.successfulUpdates}`);
    console.log(`Failed updates:           ${stats.failedUpdates}`);
    console.log(`Skipped rows:             ${stats.skippedRows}`);
    console.log('============================================================');

    if (stats.errors.length > 0) {
        console.log('');
        console.log('[ERRORS] ERRORS ENCOUNTERED:');
        console.log('------------------------------------------------------------');
        stats.errors.forEach((error, index) => {
            console.log(`${index + 1}. Type: ${error.type}`);
            if (error.row) {
                console.log(`   Row: ${error.row}`);
            }
            if (error.placeId) {
                console.log(`   Place ID: ${error.placeId}`);
            }
            console.log(`   Message: ${error.message}`);
            console.log('');
        });
    }

    if (stats.successfulUpdates === stats.totalRows - stats.skippedRows) {
        console.log('');
        console.log('[SUCCESS] Update completed successfully!');
    } else if (stats.successfulUpdates > 0) {
        console.log('');
        console.log('[WARN] Update completed with some errors.');
    } else {
        console.log('');
        console.log('[FAILED] Update failed.');
    }
}

// Run the update
(async () => {
    try {
        await updatePadelCourtsImages();
        printStatistics();
        process.exit(0);
    } catch (error) {
        console.error('');
        console.error('============================================================');
        console.error('[FATAL] FATAL ERROR');
        console.error('============================================================');
        console.error(error);
        printStatistics();
        process.exit(1);
    }
})();
