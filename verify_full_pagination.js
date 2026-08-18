// Verify the CF's exact pagination loop with the new settings.

const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

async function paginateAll(params) {
  const start = Date.now();
  let allHits = [];
  let page = 0;
  let nbPages = 1;
  let nbHits = 0;
  let operations = 0;
  while (page < nbPages) {
    const r = await index.search('', { ...params, page, hitsPerPage: 1000 });
    operations++;
    allHits.push(...r.hits);
    nbPages = r.nbPages;
    nbHits = r.nbHits;
    console.log(`  page ${page}: +${r.hits.length} hits, cumulative ${allHits.length}, nbPages: ${nbPages}, nbHits: ${nbHits}`);
    page++;
  }
  console.log(`  Total retrieved: ${allHits.length} / ${nbHits} declared`);
  console.log(`  Operations: ${operations}, wall clock: ${Date.now() - start}ms`);
  return allHits;
}

async function main() {
  console.log('=== Le Five Paris 18, Wed 19:30 ===');
  await paginateAll({
    aroundLatLng: '48.8978522,2.3700234',
    aroundRadius: 20000,
    facetFilters: [['slots:3-19:30']],
    attributesToRetrieve: ['user_id'],
  });

  console.log('\n=== Gerland Lyon, Wed 19:00 ===');
  await paginateAll({
    aroundLatLng: '45.7213257,4.8272967',
    aroundRadius: 20000,
    facetFilters: [['slots:3-19:00']],
    attributesToRetrieve: ['user_id'],
  });
}
main().catch(e => { console.error(e); process.exit(1); });
