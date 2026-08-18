#!/usr/bin/env node

/**
 * Script to add the sport field to all existing repeater documents.
 *
 * This script:
 * 1. Finds all repeaters in the collection
 * 2. Filters to those missing the sport field
 * 3. Sets sport = "soccer" for those repeaters
 *
 * Usage:
 *   node scripts/add-sport-to-repeaters.js [--dry-run]
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addSportToRepeaters(dryRun = false) {
    console.log('Starting sport field addition to repeaters...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('---');

    try {
        // Fetch all repeaters in batches
        console.log('Fetching all repeaters in batches...');
        const FETCH_BATCH_SIZE = 1000;
        let allRepeaters = [];
        let lastDoc = null;
        let fetchBatch = 0;

        while (true) {
            let query = db.collection('repeaters')
                .limit(FETCH_BATCH_SIZE);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                break;
            }

            snapshot.forEach(doc => allRepeaters.push(doc));
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            fetchBatch++;

            console.log(`Fetched batch ${fetchBatch}: ${snapshot.size} docs (Total: ${allRepeaters.length})`);

            // Safety check to avoid infinite loops
            if (fetchBatch > 50) {
                console.log('⚠️  Reached safety limit of 50 batches. Stopping fetch.');
                break;
            }
        }

        console.log(`Total repeaters found: ${allRepeaters.length}`);

        // Filter repeaters without sport field
        const repeatersWithoutSport = [];
        allRepeaters.forEach(doc => {
            const data = doc.data();
            if (!data.sport || data.sport === null || data.sport === undefined || data.sport === '') {
                repeatersWithoutSport.push({
                    id: doc.id,
                    weekday: data.weekday ?? 'N/A',
                    expectedTime: data.expectedTime || 'N/A',
                    centre: data.centre || 'N/A',
                    organizer: data.organizer || 'N/A'
                });
            }
        });

        console.log(`Repeaters without sport field: ${repeatersWithoutSport.length}`);
        console.log('---');

        if (repeatersWithoutSport.length === 0) {
            console.log('✅ No repeaters need updating. All repeaters have the sport field!');
            return;
        }

        // Display sample of repeaters to be updated
        console.log('Sample of repeaters to be updated:');
        repeatersWithoutSport.slice(0, 10).forEach(repeater => {
            const weekdayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][repeater.weekday] || repeater.weekday;
            console.log(`  - ${repeater.id} | ${weekdayName} ${repeater.expectedTime} | ${repeater.centre}`);
        });
        if (repeatersWithoutSport.length > 10) {
            console.log(`  ... and ${repeatersWithoutSport.length - 10} more`);
        }
        console.log('---');

        if (dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log(`Would update ${repeatersWithoutSport.length} repeaters with sport: "soccer"`);
            return;
        }

        // Proceed with updates
        console.log('Starting batch updates...');
        let updatedCount = 0;
        let failedCount = 0;
        const batchSize = 500;

        // Process in batches of 500 (Firestore batch limit)
        for (let i = 0; i < repeatersWithoutSport.length; i += batchSize) {
            const batch = db.batch();
            const batchRepeaters = repeatersWithoutSport.slice(i, i + batchSize);

            batchRepeaters.forEach(repeater => {
                const repeaterRef = db.collection('repeaters').doc(repeater.id);
                batch.update(repeaterRef, { sport: 'soccer' });
            });

            try {
                await batch.commit();
                updatedCount += batchRepeaters.length;
                console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: Updated ${batchRepeaters.length} repeaters (total: ${updatedCount})`);
            } catch (error) {
                failedCount += batchRepeaters.length;
                console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
            }
        }

        console.log('---');
        console.log('Migration complete!');
        console.log(`✅ Successfully updated: ${updatedCount} repeaters`);
        if (failedCount > 0) {
            console.log(`❌ Failed to update: ${failedCount} repeaters`);
        }
        console.log('---');

    } catch (error) {
        console.error('Fatal error during migration:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the migration
addSportToRepeaters(dryRun)
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
