// What if we push the slot filter down to Algolia?
// This tests whether adding `slots` as a facet + filtering server-side would
// solve the read-volume problem without changing anything else.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');

const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

async function test(label, params) {
  console.log(`\n[${label}]`);
  const start = Date.now();
  const r = await index.search('', params);
  console.log(`  params: ${JSON.stringify(params)}`);
  console.log(`  nbHits: ${r.nbHits}`);
  console.log(`  nbPages: ${r.nbPages}`);
  console.log(`  exhaustiveNbHits: ${r.exhaustiveNbHits}`);
  console.log(`  hits returned: ${r.hits.length}`);
  console.log(`  processingTimeMS: ${r.processingTimeMS}`);
  console.log(`  wall clock: ${Date.now() - start}ms`);
  return r;
}

async function main() {
  const paris = '48.8978522,2.3700234';

  console.log('=== Testing filter approaches for Le Five Paris 18, Wed 19:30 ===');

  // Approach 1 (current): retrieve everything within radius, filter client-side
  await test('Current: no filter, geo-only', {
    aroundLatLng: paris,
    aroundRadius: 20000,
    hitsPerPage: 1000,
    attributesToRetrieve: ['user_id', 'slots'],
  });

  // Approach 2: filter with searchable attribute (assumes slots is default searchable)
  // Won't work well because Algolia's text search doesn't understand our slot format
  await test('Slot as query string', {
    query: '3-19:30',
    aroundLatLng: paris,
    aroundRadius: 20000,
    hitsPerPage: 1000,
    attributesToRetrieve: ['user_id'],
  });

  // Approach 3: numeric-like filter — currently not configured but showing what happens
  await test('facetFilters: slots (NOT CONFIGURED — should return default)', {
    aroundLatLng: paris,
    aroundRadius: 20000,
    facetFilters: [['slots:3-19:30']],
    hitsPerPage: 1000,
    attributesToRetrieve: ['user_id'],
  });

  // Approach 4: filters string syntax
  await test('filters: slots:"3-19:30"', {
    aroundLatLng: paris,
    aroundRadius: 20000,
    filters: 'slots:"3-19:30"',
    hitsPerPage: 1000,
    attributesToRetrieve: ['user_id'],
  });
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
