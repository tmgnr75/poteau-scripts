#!/usr/bin/env node

/**
 * Script to backfill the sport field for past games that don't have it.
 *
 * This script:
 * 1. Finds all games with date < now
 * 2. Filters to those missing the sport field
 * 3. Sets sport = "soccer" for those games
 *
 * Usage:
 *   node scripts/backfill-sport-field.js [--dry-run]
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backfillSportField(dryRun = false) {
    console.log('Starting sport field backfill...');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('---');

    try {
        const now = new Date();
        console.log(`Current time: ${now.toISOString()}`);

        // Fetch all past games in batches
        console.log('Fetching past games in batches...');
        const FETCH_BATCH_SIZE = 10000;
        let allPastGames = [];
        let lastDoc = null;
        let fetchBatch = 0;

        while (true) {
            let query = db.collection('games')
                .where('date', '<', now)
                .limit(FETCH_BATCH_SIZE);

            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }

            const snapshot = await query.get();

            if (snapshot.empty) {
                break;
            }

            snapshot.forEach(doc => allPastGames.push(doc));
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            fetchBatch++;

            console.log(`Fetched batch ${fetchBatch}: ${snapshot.size} docs (Total: ${allPastGames.length})`);

            // Safety check to avoid infinite loops
            if (fetchBatch > 20) {
                console.log('⚠️  Reached safety limit of 20 batches (200k docs). Stopping fetch.');
                break;
            }
        }

        console.log(`Total past games found: ${allPastGames.length}`);

        // Filter games without sport field
        const gamesWithoutSport = [];
        allPastGames.forEach(doc => {
            const data = doc.data();
            if (!data.sport || data.sport === null || data.sport === undefined || data.sport === '') {
                gamesWithoutSport.push({
                    id: doc.id,
                    date: data.date?.toDate?.() || data.date,
                    centre: data.centre || 'N/A',
                    type: data.type || 'N/A',
                    organizer: data.organizer || 'N/A'
                });
            }
        });

        console.log(`Games without sport field: ${gamesWithoutSport.length}`);
        console.log('---');

        if (gamesWithoutSport.length === 0) {
            console.log('✅ No games need updating. All past games have the sport field!');
            return;
        }

        // Display sample of games to be updated
        console.log('Sample of games to be updated:');
        gamesWithoutSport.slice(0, 5).forEach(game => {
            console.log(`  - ${game.id} | ${game.date.toISOString?.()} | ${game.centre} | type: ${game.type}`);
        });
        if (gamesWithoutSport.length > 5) {
            console.log(`  ... and ${gamesWithoutSport.length - 5} more`);
        }
        console.log('---');

        if (dryRun) {
            console.log('🔍 DRY RUN MODE - No changes will be made');
            console.log(`Would update ${gamesWithoutSport.length} games with sport: "soccer"`);
            return;
        }

        // Proceed with updates
        console.log('Starting batch updates...');
        let updatedCount = 0;
        let failedCount = 0;
        const batchSize = 500;

        // Process in batches of 500 (Firestore batch limit)
        for (let i = 0; i < gamesWithoutSport.length; i += batchSize) {
            const batch = db.batch();
            const batchGames = gamesWithoutSport.slice(i, i + batchSize);

            batchGames.forEach(game => {
                const gameRef = db.collection('games').doc(game.id);
                batch.update(gameRef, { sport: 'soccer' });
            });

            try {
                await batch.commit();
                updatedCount += batchGames.length;
                console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: Updated ${batchGames.length} games (total: ${updatedCount})`);
            } catch (error) {
                failedCount += batchGames.length;
                console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
            }
        }

        console.log('---');
        console.log('Backfill complete!');
        console.log(`✅ Successfully updated: ${updatedCount} games`);
        if (failedCount > 0) {
            console.log(`❌ Failed to update: ${failedCount} games`);
        }
        console.log('---');

    } catch (error) {
        console.error('Fatal error during backfill:', error);
        process.exit(1);
    }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run the backfill
backfillSportField(dryRun)
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Script failed:', error);
        process.exit(1);
    });
