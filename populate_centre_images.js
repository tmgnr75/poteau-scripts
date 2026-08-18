const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

/**
 * Script to populate centre_image in cached_centres collection
 * from the first picture in location_pictures collection
 */
async function populateCentreImages() {
  console.log('='.repeat(80));
  console.log('Starting centre_image population script');
  console.log('='.repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  try {
    // Step 1: Fetch all documents from location_pictures
    console.log('Step 1: Fetching all documents from location_pictures collection...');
    const locationPicturesSnapshot = await db.collection('location_pictures').get();

    console.log(`✓ Found ${locationPicturesSnapshot.size} documents in location_pictures`);
    console.log('');

    if (locationPicturesSnapshot.empty) {
      console.log('⚠ No documents found in location_pictures collection. Exiting.');
      return;
    }

    // Statistics tracking
    let stats = {
      totalProcessed: 0,
      updated: 0,
      skippedAlreadySet: 0,
      skippedNoPictures: 0,
      skippedNoMatch: 0,
      errors: 0,
    };

    // Step 2: Process each location_pictures document
    console.log('Step 2: Processing each location_pictures document...');
    console.log('-'.repeat(80));

    for (const locationPicDoc of locationPicturesSnapshot.docs) {
      const locationId = locationPicDoc.id;
      const locationData = locationPicDoc.data();

      stats.totalProcessed++;

      console.log(`\n[${stats.totalProcessed}/${locationPicturesSnapshot.size}] Processing location: ${locationId}`);

      // Check if pictures array exists and has at least one item
      if (!locationData.pictures || !Array.isArray(locationData.pictures) || locationData.pictures.length === 0) {
        console.log(`  ⚠ No pictures found in location_pictures/${locationId} - skipping`);
        stats.skippedNoPictures++;
        continue;
      }

      const firstPicture = locationData.pictures[0];
      console.log(`  ℹ Found ${locationData.pictures.length} picture(s), using first: "${firstPicture}"`);

      // Step 3: Check if corresponding document exists in cached_centres
      console.log(`  → Checking cached_centres/${locationId}...`);
      const cachedCentreRef = db.collection('cached_centres').doc(locationId);
      const cachedCentreDoc = await cachedCentreRef.get();

      if (!cachedCentreDoc.exists) {
        console.log(`  ⚠ No matching document found in cached_centres/${locationId} - skipping`);
        stats.skippedNoMatch++;
        continue;
      }

      const cachedCentreData = cachedCentreDoc.data();

      // Step 4: Check if centre_image is already set
      if (cachedCentreData.centre_image) {
        console.log(`  ℹ centre_image already set to: "${cachedCentreData.centre_image}" - skipping`);
        stats.skippedAlreadySet++;
        continue;
      }

      // Step 5: Update the document with centre_image
      try {
        console.log(`  → Updating cached_centres/${locationId} with centre_image...`);
        await cachedCentreRef.update({
          centre_image: firstPicture
        });

        console.log(`  ✓ Successfully updated cached_centres/${locationId}`);
        console.log(`    centre_image set to: "${firstPicture}"`);
        stats.updated++;
      } catch (error) {
        console.error(`  ✗ Error updating cached_centres/${locationId}:`, error.message);
        stats.errors++;
      }
    }

    // Step 6: Print summary
    console.log('\n');
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total location_pictures processed:        ${stats.totalProcessed}`);
    console.log(`Successfully updated:                      ${stats.updated}`);
    console.log(`Skipped (centre_image already set):        ${stats.skippedAlreadySet}`);
    console.log(`Skipped (no pictures in array):            ${stats.skippedNoPictures}`);
    console.log(`Skipped (no matching cached_centres doc):  ${stats.skippedNoMatch}`);
    console.log(`Errors:                                    ${stats.errors}`);
    console.log('='.repeat(80));
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n');
    console.error('='.repeat(80));
    console.error('FATAL ERROR');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the script
populateCentreImages()
  .then(() => {
    console.log('\nScript completed successfully. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed with error:', error);
    process.exit(1);
  });
