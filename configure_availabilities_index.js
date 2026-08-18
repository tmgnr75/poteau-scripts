// One-time Algolia index configuration for the `availabilities` index.
//
// Adds `slots` and `user_id` as `filterOnly` faceting attributes so we can push
// day/time filtering down to Algolia via facetFilters instead of retrieving
// every availability within a 20km radius and filtering client-side.
//
// Idempotent: safe to re-run. Algolia setSettings merges non-conflicting fields
// but this script explicitly reads current settings, unions the new attributes,
// and writes back.

const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');

const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
if (!ALGOLIA_ADMIN_KEY) { console.error('ERROR: ALGOLIA_ADMIN_KEY env var required'); process.exit(1); }

const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

async function main() {
  console.log('Reading current settings...');
  const current = await index.getSettings();
  const currentFaceting = current.attributesForFaceting || [];
  const currentPagLimit = current.paginationLimitedTo || 1000;
  console.log('Current attributesForFaceting:', currentFaceting);
  console.log('Current paginationLimitedTo:', currentPagLimit);

  // We want at least these entries. filterOnly is cheaper than fully faceted
  // (no counts) and is all we need for CF-side filtering.
  const wanted = new Set(currentFaceting);
  wanted.add('filterOnly(slots)');
  wanted.add('filterOnly(user_id)');
  const newFaceting = [...wanted];

  // Algolia default is 1000. In dense Paris, slot-filtered queries return up to
  // ~7000 matches per slot on popular time windows — the CF pagination loop
  // would still cap at 1000. Bump to 20000: well within Algolia's guidance for
  // filter-heavy queries, still means at most ~20 sequential pages if we ever
  // exhaust it (in practice: 4-7).
  const newPagLimit = 20000;

  const facetingChanged = JSON.stringify(currentFaceting.sort()) !== JSON.stringify(newFaceting.sort());
  const pagLimitChanged = currentPagLimit !== newPagLimit;

  if (!facetingChanged && !pagLimitChanged) {
    console.log('No change needed. Exiting.');
    process.exit(0);
  }

  const settings = {};
  if (facetingChanged) {
    settings.attributesForFaceting = newFaceting;
    console.log('New attributesForFaceting:', newFaceting);
  }
  if (pagLimitChanged) {
    settings.paginationLimitedTo = newPagLimit;
    console.log('New paginationLimitedTo:', newPagLimit);
  }

  console.log('Applying new settings...');
  const result = await index.setSettings(settings);
  console.log('setSettings taskID:', result.taskID);
  console.log('Waiting for task to complete...');
  await index.waitTask(result.taskID);
  console.log('Done. Verifying...');

  const verify = await index.getSettings();
  console.log('Verified attributesForFaceting:', verify.attributesForFaceting);
  console.log('Verified paginationLimitedTo:', verify.paginationLimitedTo);
  console.log('OK.');
  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
