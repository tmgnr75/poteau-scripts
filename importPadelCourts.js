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
    successfulImports: 0,
    failedImports: 0,
    skippedRows: 0,
    errors: []
};

/**
 * Validates a CSV row to ensure all required fields are present
 */
function validateRow(row, rowNumber) {
    const requiredFields = ['Place Id', 'Name', 'Latitude', 'Longitude'];
    const missingFields = [];

    for (const field of requiredFields) {
        if (!row[field] || row[field].trim() === '') {
            missingFields.push(field);
        }
    }

    if (missingFields.length > 0) {
        console.warn(`[WARN] Row ${rowNumber}: Missing required fields: ${missingFields.join(', ')}`);
        return false;
    }

    // Validate latitude and longitude are valid numbers
    const lat = parseFloat(row['Latitude']);
    const lng = parseFloat(row['Longitude']);

    if (isNaN(lat) || isNaN(lng)) {
        console.warn(`[WARN] Row ${rowNumber}: Invalid latitude or longitude values`);
        return false;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(`[WARN] Row ${rowNumber}: Latitude or longitude out of valid range`);
        return false;
    }

    return true;
}

/**
 * Transforms a CSV row into a Firestore document
 */
function transformRowToDocument(row) {
    const placeId = row['Place Id'].trim();
    const name = row['Name'].trim();
    const latitude = parseFloat(row['Latitude']);
    const longitude = parseFloat(row['Longitude']);

    return {
        docId: placeId,
        data: {
            centre_location: new admin.firestore.GeoPoint(latitude, longitude),
            centre_name: name,
            centre_place_id: placeId,
            priority: 0,
            sports: ['padel']
        }
    };
}

/**
 * Writes documents to Firestore in batches
 */
async function writeBatch(documents) {
    const batch = db.batch();

    console.log(`[BATCH] Preparing batch of ${documents.length} documents...`);

    for (const doc of documents) {
        const docRef = db.collection(COLLECTION_NAME).doc(doc.docId);
        batch.set(docRef, doc.data);
    }

    try {
        await batch.commit();
        console.log(`[SUCCESS] Successfully wrote ${documents.length} documents to Firestore`);
        stats.successfulImports += documents.length;
    } catch (error) {
        console.error(`[ERROR] Error writing batch:`, error.message);
        stats.failedImports += documents.length;
        stats.errors.push({
            type: 'batch_write',
            message: error.message,
            documentsCount: documents.length
        });
        throw error;
    }
}

/**
 * Main import function
 */
async function importPadelCourts() {
    console.log('[START] Padel Courts Import Process');
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

    const documents = [];
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

                // Transform and add to documents array
                try {
                    const document = transformRowToDocument(row);
                    documents.push(document);

                    console.log(`[OK] Row ${rowNumber}: ${document.data.centre_name} (${document.docId})`);
                } catch (error) {
                    console.error(`[ERROR] Row ${rowNumber}: Error transforming row:`, error.message);
                    stats.skippedRows++;
                    stats.errors.push({
                        type: 'transformation',
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
                console.log(`[STATS] Valid documents to import: ${documents.length}`);
                console.log(`[STATS] Skipped rows: ${stats.skippedRows}`);
                console.log('============================================================');
                console.log('');

                if (documents.length === 0) {
                    console.log('[WARN] No valid documents to import. Exiting.');
                    resolve();
                    return;
                }

                // Write documents in batches
                console.log('[FIRESTORE] Starting batch writes...');
                console.log('');

                try {
                    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
                        const batch = documents.slice(i, Math.min(i + BATCH_SIZE, documents.length));
                        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
                        const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

                        console.log(`[BATCH ${batchNumber}/${totalBatches}] Processing documents ${i + 1}-${i + batch.length}:`);
                        await writeBatch(batch);
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
    console.log('[STATISTICS] IMPORT STATISTICS');
    console.log('============================================================');
    console.log(`Total rows processed:     ${stats.totalRows}`);
    console.log(`Successful imports:       ${stats.successfulImports}`);
    console.log(`Failed imports:           ${stats.failedImports}`);
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
            console.log(`   Message: ${error.message}`);
            console.log('');
        });
    }

    if (stats.successfulImports === stats.totalRows - stats.skippedRows) {
        console.log('');
        console.log('[SUCCESS] Import completed successfully!');
    } else if (stats.successfulImports > 0) {
        console.log('');
        console.log('[WARN] Import completed with some errors.');
    } else {
        console.log('');
        console.log('[FAILED] Import failed.');
    }
}

// Run the import
(async () => {
    try {
        await importPadelCourts();
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
