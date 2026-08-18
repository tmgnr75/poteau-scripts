/**
 * Script de comptage pour estimer le coût de la migration
 * Ne fait AUCUNE écriture, juste des lectures
 *
 * Usage: node countAlertsForMigration.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function countAndEstimate() {
  console.log('📊 Analyse de la migration alerts → play_slots\n');
  console.log('='.repeat(50));

  // 1. Compter les cached_centres
  console.log('\n📦 Cached Centres...');
  const cachedCentresSnapshot = await db.collection('cached_centres').get();
  const cachedCentresCount = cachedCentresSnapshot.size;

  // Construire un Set de tous les placeIds en cache
  const cachedPlaceIds = new Set();
  cachedCentresSnapshot.forEach(doc => {
    const placeId = doc.data().centre_place_id;
    if (placeId) cachedPlaceIds.add(placeId);
  });
  console.log(`   ${cachedCentresCount} centres en cache`);

  // 2. Analyser les alertes
  console.log('\n📋 Alertes...');
  const alertsSnapshot = await db.collection('alerts').get();
  const alertsCount = alertsSnapshot.size;
  console.log(`   ${alertsCount} alertes au total`);

  // 3. Compter les places et analyser le cache hit rate
  let totalPlaces = 0;
  let placesInCache = 0;
  let placesNotInCache = 0;
  const uniquePlaceIds = new Set();
  const missingPlaceIds = new Map(); // placeId → count (pour voir lesquels manquent le plus)

  alertsSnapshot.forEach(doc => {
    const alert = doc.data();
    const places = alert.places || [];

    places.forEach(place => {
      totalPlaces++;
      const placeId = place.placeId;

      if (placeId) {
        uniquePlaceIds.add(placeId);

        if (cachedPlaceIds.has(placeId)) {
          placesInCache++;
        } else {
          placesNotInCache++;
          missingPlaceIds.set(placeId, (missingPlaceIds.get(placeId) || 0) + 1);
        }
      }
    });
  });

  const cacheHitRate = totalPlaces > 0 ? ((placesInCache / totalPlaces) * 100).toFixed(1) : 0;

  console.log(`   ${totalPlaces} places au total (${uniquePlaceIds.size} uniques)`);
  console.log(`   ${placesInCache} en cache (${cacheHitRate}%)`);
  console.log(`   ${placesNotInCache} hors cache`);

  // 4. Estimation des coûts
  console.log('\n' + '='.repeat(50));
  console.log('💰 ESTIMATION DES COÛTS');
  console.log('='.repeat(50));

  // Firestore reads
  const readsCount = cachedCentresCount + alertsCount;
  const readsCost = (readsCount / 100000) * 0.06;

  // Firestore writes (1 play_slot par place)
  const writesCount = totalPlaces;
  const writesCost = (writesCount / 100000) * 0.18;

  // Google Places API (seulement pour les placeIds uniques non cachés)
  const uniqueMissingPlaceIds = missingPlaceIds.size;
  const googleApiCost = uniqueMissingPlaceIds * 0.017; // ~$17 per 1000 requests

  const totalCost = readsCost + writesCost + googleApiCost;

  console.log('\nFirestore:');
  console.log(`   Lectures: ${readsCount.toLocaleString()} docs → $${readsCost.toFixed(4)}`);
  console.log(`   Écritures: ${writesCount.toLocaleString()} docs → $${writesCost.toFixed(4)}`);

  console.log('\nGoogle Places API:');
  console.log(`   Appels nécessaires: ${uniqueMissingPlaceIds} (placeIds uniques hors cache)`);
  console.log(`   Coût estimé: $${googleApiCost.toFixed(2)} (à ~$0.017/requête)`);

  console.log('\n' + '-'.repeat(50));
  console.log(`TOTAL ESTIMÉ: $${totalCost.toFixed(2)}`);
  console.log('-'.repeat(50));

  // 5. Top 10 des placeIds manquants (pour décider si on veut les ajouter au cache d'abord)
  if (missingPlaceIds.size > 0) {
    console.log('\n⚠️  Top 10 des centres hors cache (les plus fréquents):');
    const sortedMissing = [...missingPlaceIds.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    sortedMissing.forEach(([placeId, count], i) => {
      console.log(`   ${i + 1}. ${placeId.substring(0, 30)}... (${count} alertes)`);
    });

    console.log('\n💡 Suggestion: Ajouter ces centres à cached_centres avant la migration');
    console.log('   pour économiser les appels Google API.');
  }

  // 6. Résumé
  console.log('\n' + '='.repeat(50));
  console.log('📝 RÉSUMÉ');
  console.log('='.repeat(50));
  console.log(`\nLa migration va créer ${totalPlaces} documents play_slots`);
  console.log(`à partir de ${alertsCount} alertes.`);

  if (cacheHitRate >= 90) {
    console.log(`\n✅ Excellent cache hit rate (${cacheHitRate}%) !`);
    console.log('   Les coûts Google API seront minimaux.');
  } else if (cacheHitRate >= 70) {
    console.log(`\n⚠️  Cache hit rate moyen (${cacheHitRate}%)`);
    console.log('   Considère ajouter les centres manquants à cached_centres.');
  } else {
    console.log(`\n❌ Cache hit rate faible (${cacheHitRate}%)`);
    console.log('   Fortement recommandé d\'enrichir cached_centres d\'abord.');
  }
}

countAndEstimate()
  .then(() => {
    console.log('\n✅ Analyse terminée');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
