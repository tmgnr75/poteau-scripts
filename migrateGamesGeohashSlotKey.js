#!/usr/bin/env node

/**
 * One-shot migration script: adds geohash_5 and slot_key to future games that don't have them.
 *
 * - geohash_5: precision-5 geohash derived from the game's location (GeoPoint)
 * - slot_key:  "{isoDay}-{HH}:{mm}" derived from the game's date + time_zone
 *
 * Usage:
 *   node scripts/migrateGamesGeohashSlotKey.js [--dry-run]
 *
 * --dry-run: logs what would be updated without writing anything
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const { encodeGeohash, toSlotKey } = require('../cloud-functions/functions/shared/geohashUtils');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
    console.log(`Starting geohash_5 + slot_key migration for future games...`);
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
    console.log('---');

    const now = admin.firestore.Timestamp.now();

    // Only fetch future games (date >= now)
    const gamesSnapshot = await db
        .collection('games')
        .where('date', '>=', now)
        .get();

    console.log(`Found ${gamesSnapshot.size} future games.`);

    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    let noLocation = 0;
    let noDate = 0;

    const BATCH_LIMIT = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of gamesSnapshot.docs) {
        const data = doc.data();
        const updates = {};

        try {
            // --- geohash_5 ---
            if (!data.geohash_5) {
                if (data.location && data.location.latitude && data.location.longitude) {
                    updates.geohash_5 = encodeGeohash(data.location.latitude, data.location.longitude, 5);
                } else {
                    noLocation++;
                    // Can't compute geohash without location — skip this field
                }
            }

            // --- slot_key ---
            if (!data.slot_key) {
                if (data.date) {
                    const gameDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
                    const timeZone = data.time_zone || 'Europe/Paris';
                    updates.slot_key = toSlotKey(gameDate, timeZone);
                } else {
                    noDate++;
                    // Can't compute slot_key without date — skip this field
                }
            }

            if (Object.keys(updates).length > 0) {
                if (DRY_RUN) {
                    console.log(`[DRY RUN] Would update ${doc.id}:`, updates);
                } else {
                    batch.update(doc.ref, updates);
                    batchCount++;
                }
                migrated++;

                // Commit batch when it hits the limit
                if (!DRY_RUN && batchCount >= BATCH_LIMIT) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} updates...`);
                    batch = db.batch();
                    batchCount = 0;
                }
            } else {
                skipped++;
            }
        } catch (e) {
            console.error(`Error processing game ${doc.id}:`, e.message);
            errors++;
        }
    }

    // Commit any remaining updates
    if (!DRY_RUN && batchCount > 0) {
        await batch.commit();
        console.log(`Committed final batch of ${batchCount} updates.`);
    }

    console.log('---');
    console.log('Migration complete.');
    console.log(`  Total future games: ${gamesSnapshot.size}`);
    console.log(`  Migrated:           ${migrated}`);
    console.log(`  Skipped (already):  ${skipped}`);
    console.log(`  No location:        ${noLocation}`);
    console.log(`  No date:            ${noDate}`);
    console.log(`  Errors:             ${errors}`);
}

migrate().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
