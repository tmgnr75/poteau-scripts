/**
 * Construit un cache de locations à partir de:
 * 1. cached_centres
 * 2. games (pour les placeIds manquants)
 *
 * Objectif: 0$ de Google API
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

async function buildCache() {
  console.log('🔨 Construction du cache de locations\n');
  console.log('='.repeat(60));

  const locationCache = new Map(); // placeId → { name, location }

  // 1. Charger cached_centres
  console.log('\n📦 Étape 1: cached_centres...');
  const cachedCentresSnapshot = await db.collection('cached_centres').get();

  cachedCentresSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.centre_place_id && data.centre_location) {
      locationCache.set(data.centre_place_id, {
        name: data.centre_name,
        location: data.centre_location,
        source: 'cached_centres',
      });
    }
  });
  console.log(`   ✅ ${locationCache.size} locations depuis cached_centres`);

  // 2. Charger games (pour les placeIds qu'on n'a pas encore)
  console.log('\n🎮 Étape 2: games...');
  const gamesSnapshot = await db.collection('games').get();

  let addedFromGames = 0;
  gamesSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.place_id && data.location && !locationCache.has(data.place_id)) {
      locationCache.set(data.place_id, {
        name: data.centre || 'Unknown',
        location: data.location,
        source: 'games',
      });
      addedFromGames++;
    }
  });
  console.log(`   ✅ ${addedFromGames} locations ajoutées depuis games`);
  console.log(`   📊 Cache total: ${locationCache.size} placeIds`);

  // 3. Analyser les alertes pour voir la couverture
  console.log('\n📋 Étape 3: Analyse des alertes...');
  const alertsSnapshot = await db.collection('alerts').get();

  let totalPlaces = 0;
  let foundInCache = 0;
  let foundViaMapping = 0;
  let notFound = 0;
  const missingPlaceIds = new Map();

  alertsSnapshot.forEach(doc => {
    const places = doc.data().places || [];

    places.forEach(place => {
      totalPlaces++;
      let placeId = place.placeId;

      // Essayer le mapping manuel
      if (MANUAL_MAPPINGS[placeId]) {
        placeId = MANUAL_MAPPINGS[placeId];
        if (locationCache.has(placeId)) {
          foundViaMapping++;
          return;
        }
      }

      if (locationCache.has(placeId)) {
        foundInCache++;
      } else {
        notFound++;
        missingPlaceIds.set(placeId, (missingPlaceIds.get(placeId) || 0) + 1);
      }
    });
  });

  const coveragePercent = (((foundInCache + foundViaMapping) / totalPlaces) * 100).toFixed(1);

  console.log(`\n   Total places dans alertes: ${totalPlaces.toLocaleString()}`);
  console.log(`   ✅ Trouvées dans cache: ${foundInCache.toLocaleString()}`);
  console.log(`   ✅ Trouvées via mapping: ${foundViaMapping.toLocaleString()}`);
  console.log(`   ❌ Non trouvées: ${notFound.toLocaleString()}`);
  console.log(`\n   📈 Couverture: ${coveragePercent}%`);

  // 4. Afficher les placeIds toujours manquants
  if (missingPlaceIds.size > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('⚠️  PlaceIds toujours manquants (top 20):');
    console.log('='.repeat(60));

    const sortedMissing = [...missingPlaceIds.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    sortedMissing.forEach(([placeId, count], i) => {
      const truncated = placeId.length > 45 ? placeId.substring(0, 45) + '...' : placeId;
      console.log(`${(i+1).toString().padStart(2)}. ${truncated.padEnd(50)} ${count} alertes`);
    });

    // Combien de places pour les top 100 manquants ?
    const top100Missing = [...missingPlaceIds.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100);
    const top100PlacesCount = top100Missing.reduce((sum, [_, count]) => sum + count, 0);

    console.log(`\n💡 Si on query Google pour les top 100 manquants:`);
    console.log(`   → On couvrirait ${top100PlacesCount} places supplémentaires`);
    console.log(`   → Coût: ~$1.70`);
    console.log(`   → Couverture totale: ${(((foundInCache + foundViaMapping + top100PlacesCount) / totalPlaces) * 100).toFixed(1)}%`);

    // Fallback
    const remainingPlaces = notFound - top100PlacesCount;
    console.log(`\n   Pour les ${remainingPlaces} places restantes → utiliser last_location du user`);
  }

  // 5. Résumé final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));

  if (coveragePercent >= 95) {
    console.log(`\n✅ Excellente couverture (${coveragePercent}%) !`);
    console.log('   Tu peux lancer la migration avec $0 de Google API.');
    console.log('   Les quelques % restants utiliseront la location du user.');
  } else if (coveragePercent >= 85) {
    console.log(`\n⚠️  Bonne couverture (${coveragePercent}%)`);
    console.log('   Option A: Lancer la migration, fallback sur location user');
    console.log('   Option B: Query Google pour les top 100 manquants (~$1.70)');
  } else {
    console.log(`\n❌ Couverture insuffisante (${coveragePercent}%)`);
    console.log('   Recommandation: Query Google pour les placeIds manquants fréquents');
  }

  // Exporter le cache pour usage dans la migration
  console.log('\n📁 Export du cache...');
  const cacheExport = {};
  locationCache.forEach((value, key) => {
    cacheExport[key] = {
      name: value.name,
      lat: value.location._latitude || value.location.latitude,
      lng: value.location._longitude || value.location.longitude,
      source: value.source,
    };
  });

  const fs = require('fs');
  fs.writeFileSync('./locationCache.json', JSON.stringify(cacheExport, null, 2));
  console.log('   ✅ Sauvegardé dans locationCache.json');
}

buildCache()
  .then(() => {
    console.log('\n✅ Terminé');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
