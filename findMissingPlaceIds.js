/**
 * Step 1 : Trouver tous les place_id manquants
 *
 * Logique :
 * 1. Charger cached_centres en mémoire
 * 2. Parcourir les alertes
 * 3. Pour chaque placeId pas dans cached_centres → query UN game
 * 4. Si toujours pas trouvé → ajouter au Set des manquants
 * 5. Sauvegarder le Set en local
 */

const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Mapping manuel
const MANUAL_MAPPINGS = {
  'impulstarpark': 'ChIJLdkocwBh5kcR14AXaHHKBaw',
};

// Stats
const stats = {
  totalPlaces: 0,
  foundInCachedCentres: 0,
  foundInGames: 0,
  foundViaMapping: 0,
  notFound: 0,
};

// Cache des placeIds déjà cherchés dans games (pour éviter de requery)
const gamesLookupCache = new Map(); // placeId → location | null

// Set des placeIds manquants
const missingPlaceIds = new Map(); // placeId → { count, centreName }

async function loadCachedCentres() {
  console.log('📦 Chargement de cached_centres...');
  const snapshot = await db.collection('cached_centres').get();

  const cache = new Map();
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.centre_place_id) {
      cache.set(data.centre_place_id, {
        name: data.centre_name,
        location: data.centre_location,
      });
    }
  });

  console.log(`   ✅ ${cache.size} centres en cache\n`);
  return cache;
}

async function findLocationInGames(placeId) {
  // Déjà cherché ?
  if (gamesLookupCache.has(placeId)) {
    return gamesLookupCache.get(placeId);
  }

  // Query un seul game avec ce place_id
  const snapshot = await db.collection('games')
    .where('place_id', '==', placeId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const game = snapshot.docs[0].data();
    if (game.location) {
      const result = {
        name: game.centre || 'Unknown',
        location: game.location,
      };
      gamesLookupCache.set(placeId, result);
      return result;
    }
  }

  gamesLookupCache.set(placeId, null);
  return null;
}

async function processAlerts(cachedCentres) {
  console.log('📋 Parcours des alertes...\n');

  const alertsSnapshot = await db.collection('alerts').get();
  const totalAlerts = alertsSnapshot.size;
  console.log(`   ${totalAlerts} alertes à traiter\n`);

  let processed = 0;

  for (const alertDoc of alertsSnapshot.docs) {
    const alert = alertDoc.data();
    const places = alert.places || [];

    for (const place of places) {
      stats.totalPlaces++;

      let placeId = place.placeId;
      const centreName = place.centre || 'Unknown';

      if (!placeId) continue;

      // 1. Mapping manuel
      if (MANUAL_MAPPINGS[placeId]) {
        placeId = MANUAL_MAPPINGS[placeId];
        stats.foundViaMapping++;
      }

      // 2. Chercher dans cached_centres
      if (cachedCentres.has(placeId)) {
        stats.foundInCachedCentres++;
        continue;
      }

      // 3. Chercher dans games
      const gameLocation = await findLocationInGames(placeId);
      if (gameLocation) {
        stats.foundInGames++;
        continue;
      }

      // 4. Pas trouvé → ajouter aux manquants
      stats.notFound++;
      if (!missingPlaceIds.has(placeId)) {
        missingPlaceIds.set(placeId, { count: 0, centreName });
      }
      missingPlaceIds.get(placeId).count++;
    }

    processed++;
    if (processed % 1000 === 0) {
      const percent = ((processed / totalAlerts) * 100).toFixed(1);
      console.log(`   ⏳ ${processed}/${totalAlerts} alertes (${percent}%)...`);
    }
  }
}

async function run() {
  console.log('🔍 Recherche des place_id manquants\n');
  console.log('='.repeat(60) + '\n');

  // 1. Charger le cache
  const cachedCentres = await loadCachedCentres();

  // 2. Traiter les alertes
  await processAlerts(cachedCentres);

  // 3. Rapport
  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSULTAT');
  console.log('='.repeat(60));

  console.log(`\nTotal places: ${stats.totalPlaces.toLocaleString()}`);
  console.log(`├── Trouvées dans cached_centres: ${stats.foundInCachedCentres.toLocaleString()}`);
  console.log(`├── Trouvées dans games: ${stats.foundInGames.toLocaleString()}`);
  console.log(`├── Via mapping manuel: ${stats.foundViaMapping.toLocaleString()}`);
  console.log(`└── ❌ Non trouvées: ${stats.notFound.toLocaleString()}`);

  const foundTotal = stats.foundInCachedCentres + stats.foundInGames;
  const coveragePercent = ((foundTotal / stats.totalPlaces) * 100).toFixed(2);
  console.log(`\n📈 Couverture: ${coveragePercent}%`);

  console.log(`\n🔢 PlaceIds uniques manquants: ${missingPlaceIds.size}`);

  // 4. Top 20 manquants
  if (missingPlaceIds.size > 0) {
    console.log('\n⚠️  Top 20 des place_id manquants:');
    console.log('─'.repeat(70));

    const sorted = [...missingPlaceIds.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20);

    sorted.forEach(([placeId, data], i) => {
      const truncatedId = placeId.length > 30 ? placeId.substring(0, 30) + '...' : placeId;
      console.log(`${(i+1).toString().padStart(2)}. ${truncatedId.padEnd(35)} ${data.count.toString().padStart(5)} alertes  "${data.centreName}"`);
    });
  }

  // 5. Sauvegarder les manquants
  const missingArray = [...missingPlaceIds.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([placeId, data]) => ({
      placeId,
      count: data.count,
      centreName: data.centreName,
    }));

  fs.writeFileSync(
    './missingPlaceIds.json',
    JSON.stringify(missingArray, null, 2)
  );
  console.log('\n📁 Sauvegardé dans missingPlaceIds.json');

  // 6. Résumé coût si Google
  if (missingPlaceIds.size > 0) {
    const googleCost = (missingPlaceIds.size * 0.017).toFixed(2);
    console.log(`\n💰 Si Google API pour tous: $${googleCost}`);
  }
}

run()
  .then(() => {
    console.log('\n✅ Terminé');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
