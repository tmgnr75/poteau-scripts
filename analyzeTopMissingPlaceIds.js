/**
 * Analyse les placeIds manquants et propose une stratégie de migration optimisée
 *
 * Objectif : trouver combien de placeIds on doit query pour couvrir X% des alertes
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapping manuel des placeIds connus
const MANUAL_MAPPINGS = {
  'impulstarpark': 'ChIJLdkocwBh5kcR14AXaHHKBaw',
  // Ajoute d'autres ici si besoin
};

async function analyze() {
  console.log('📊 Analyse des placeIds manquants\n');

  // 1. Charger le cache
  const cachedCentresSnapshot = await db.collection('cached_centres').get();
  const cachedPlaceIds = new Set();
  cachedCentresSnapshot.forEach(doc => {
    const placeId = doc.data().centre_place_id;
    if (placeId) cachedPlaceIds.add(placeId);
  });
  console.log(`📦 ${cachedPlaceIds.size} placeIds en cache\n`);

  // 2. Analyser les alertes
  const alertsSnapshot = await db.collection('alerts').get();
  const missingPlaceIds = new Map(); // placeId → count

  let totalPlaces = 0;
  let placesInCache = 0;
  let placesWithManualMapping = 0;

  alertsSnapshot.forEach(doc => {
    const places = doc.data().places || [];
    places.forEach(place => {
      totalPlaces++;
      let placeId = place.placeId;

      // Appliquer le mapping manuel
      if (MANUAL_MAPPINGS[placeId]) {
        placeId = MANUAL_MAPPINGS[placeId];
        placesWithManualMapping++;
      }

      if (cachedPlaceIds.has(placeId)) {
        placesInCache++;
      } else {
        missingPlaceIds.set(placeId, (missingPlaceIds.get(placeId) || 0) + 1);
      }
    });
  });

  // 3. Trier par fréquence
  const sortedMissing = [...missingPlaceIds.entries()]
    .sort((a, b) => b[1] - a[1]);

  const totalMissingPlaces = sortedMissing.reduce((sum, [_, count]) => sum + count, 0);

  console.log(`📋 Résumé:`);
  console.log(`   Total places: ${totalPlaces.toLocaleString()}`);
  console.log(`   En cache: ${placesInCache.toLocaleString()} (${((placesInCache/totalPlaces)*100).toFixed(1)}%)`);
  console.log(`   Mapping manuel (impulstarpark etc): ${placesWithManualMapping.toLocaleString()}`);
  console.log(`   Hors cache: ${totalMissingPlaces.toLocaleString()} (${sortedMissing.length} uniques)`);

  // 4. Calculer la couverture cumulative
  console.log('\n📈 Couverture cumulative (combien de places on couvre avec N queries Google):');
  console.log('─'.repeat(70));
  console.log('Queries Google │ Places couvertes │ % du hors cache │ Coût estimé');
  console.log('─'.repeat(70));

  let cumulative = 0;
  const checkpoints = [10, 25, 50, 100, 200, 500, 1000, sortedMissing.length];

  for (const checkpoint of checkpoints) {
    if (checkpoint > sortedMissing.length) break;

    cumulative = sortedMissing.slice(0, checkpoint).reduce((sum, [_, count]) => sum + count, 0);
    const percentage = ((cumulative / totalMissingPlaces) * 100).toFixed(1);
    const cost = (checkpoint * 0.017).toFixed(2);

    console.log(`${checkpoint.toString().padStart(13)} │ ${cumulative.toString().padStart(16).toLocaleString()} │ ${percentage.padStart(15)}% │ $${cost}`);
  }

  console.log('─'.repeat(70));

  // 5. Top 20 des placeIds manquants
  console.log('\n🔝 Top 20 des placeIds manquants:');
  console.log('─'.repeat(80));

  sortedMissing.slice(0, 20).forEach(([placeId, count], i) => {
    const truncatedId = placeId.length > 40 ? placeId.substring(0, 40) + '...' : placeId;
    console.log(`${(i+1).toString().padStart(2)}. ${truncatedId.padEnd(45)} ${count.toLocaleString().padStart(6)} alertes`);
  });

  // 6. Combien avec moins de 5 alertes ?
  const rareCount = sortedMissing.filter(([_, count]) => count < 5).length;
  const rarePlaces = sortedMissing.filter(([_, count]) => count < 5).reduce((sum, [_, count]) => sum + count, 0);

  console.log(`\n💡 Insight:`);
  console.log(`   ${rareCount} placeIds ont moins de 5 alertes chacun (${rarePlaces} places total)`);
  console.log(`   → Ces ${rareCount} placeIds coûteraient $${(rareCount * 0.017).toFixed(2)} pour seulement ${rarePlaces} places`);
  console.log(`   → Suggestion: utiliser la localisation du user pour ces cas rares`);

  // 7. Exporter le top 200 pour query Google
  console.log('\n📁 Export du top 200 pour query Google...');
  const top200 = sortedMissing.slice(0, 200).map(([placeId, count]) => ({
    placeId,
    alertCount: count,
  }));

  const fs = require('fs');
  fs.writeFileSync(
    './top200MissingPlaceIds.json',
    JSON.stringify(top200, null, 2)
  );
  console.log('   ✅ Sauvegardé dans top200MissingPlaceIds.json');
}

analyze()
  .then(() => {
    console.log('\n✅ Analyse terminée');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
