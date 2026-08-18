// Diagnose whether Algolia is truncating results for a big Paris game.
//
// Test cases: pull the Le Five Paris 18 game the quality sim flagged, run the
// same Algolia query the CF runs, and inspect nbHits, nbPages, hitsPerPage,
// exhaustiveNbHits. Then compare against a direct Firestore count of
// availabilities within 20km and see how far apart they are.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();
const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');

const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

const DEFAULT_SEARCH_RADIUS_M = 20000;

async function diagnose(gameId, label) {
  const doc = await db.collection('games').doc(gameId).get();
  if (!doc.exists) { console.log(`${label}: ${gameId} not found`); return; }
  const g = doc.data();
  const lat = g.location.latitude;
  const lng = g.location.longitude;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`[${label}] ${gameId}`);
  console.log(`  centre: ${g.centre}`);
  console.log(`  location: ${lat},${lng}`);
  console.log(`  radius: ${DEFAULT_SEARCH_RADIUS_M}m`);
  console.log('');

  // Run the exact query the CF runs
  console.log('Algolia response (page 0):');
  const r0 = await index.search('', {
    aroundLatLng: `${lat},${lng}`,
    aroundRadius: DEFAULT_SEARCH_RADIUS_M,
    hitsPerPage: 1000,
    page: 0,
    attributesToRetrieve: ['user_id', 'slots'],
  });
  console.log(`  nbHits            : ${r0.nbHits}`);
  console.log(`  nbPages           : ${r0.nbPages}`);
  console.log(`  hitsPerPage       : ${r0.hitsPerPage}`);
  console.log(`  page              : ${r0.page}`);
  console.log(`  exhaustiveNbHits  : ${r0.exhaustiveNbHits}`);
  console.log(`  hits returned     : ${r0.hits.length}`);
  console.log(`  processingTimeMS  : ${r0.processingTimeMS}`);

  // Try to fetch more pages
  let totalFetched = r0.hits.length;
  for (let p = 1; p < r0.nbPages; p++) {
    const rp = await index.search('', {
      aroundLatLng: `${lat},${lng}`,
      aroundRadius: DEFAULT_SEARCH_RADIUS_M,
      hitsPerPage: 1000,
      page: p,
      attributesToRetrieve: ['user_id'],
    });
    totalFetched += rp.hits.length;
    console.log(`  page ${p}: +${rp.hits.length} hits (cumulative: ${totalFetched})`);
  }
  console.log(`  total hits after pagination: ${totalFetched}`);

  // Now widen with a very generous radius to see if there's more
  console.log('\nWider Algolia search — 100km radius:');
  const rWide = await index.search('', {
    aroundLatLng: `${lat},${lng}`,
    aroundRadius: 100000,
    hitsPerPage: 1000,
    page: 0,
    attributesToRetrieve: ['user_id'],
  });
  console.log(`  nbHits (100km)    : ${rWide.nbHits}`);

  // Try the paginationLimitedTo Algolia limit (default 1000)
  console.log('\nWithout radius cap — global sort by proximity:');
  const rNoRadius = await index.search('', {
    aroundLatLng: `${lat},${lng}`,
    hitsPerPage: 1,
    page: 0,
    attributesToRetrieve: ['user_id'],
  });
  console.log(`  nbHits (no radius): ${rNoRadius.nbHits}`);
  console.log(`  Algolia's paginationLimitedTo default is 1000; if nbHits > that, results ARE capped`);

  // Firestore ground truth: total availabilities in the DB (no geo filter, just count)
  console.log('\nFirestore ground truth:');
  const totalAvail = await db.collection('availabilities').count().get();
  console.log(`  total availabilities in Firestore: ${totalAvail.data().count}`);

  // How many availabilities have a location within 20km via haversine?
  // Sample a few thousand to estimate. Doing a full scan is expensive.
  const sample = await db.collection('availabilities').limit(20000).get();
  let within20 = 0;
  for (const d of sample.docs) {
    const av = d.data();
    if (av.location?.latitude == null) continue;
    const dist = haversineMeters(lat, lng, av.location.latitude, av.location.longitude);
    if (dist <= DEFAULT_SEARCH_RADIUS_M) within20++;
  }
  console.log(`  Firestore sample: ${within20} within 20km out of ${sample.size} sampled availabilities`);
  const projectedTotal = Math.round(within20 * totalAvail.data().count / sample.size);
  console.log(`  Projected total within 20km: ~${projectedTotal}`);
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  await diagnose('Zd9opUOIuSLazjfOfQPX', 'Le Five Paris 18 (worst-hit game)');
  await diagnose('NsKTyXAuIX4S3ujRBljw', 'Plaine des Jeux Gerland (v2 wins big)');
  process.exit(0);
}
main().catch(e => { console.error('FATAL', e); process.exit(1); });
