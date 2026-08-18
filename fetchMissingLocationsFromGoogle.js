/**
 * Fetch les locations manquantes depuis Google Places API
 *
 * Usage:
 *   1. Ajoute ta clé API Google ci-dessous
 *   2. node fetchMissingLocationsFromGoogle.js
 *
 * Coût estimé: ~$34 pour 2000 queries
 */

const fs = require('fs');

// ⚠️ AJOUTE TA CLÉ API ICI
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
if (!process.env.GOOGLE_API_KEY) {
    console.error('Missing GOOGLE_API_KEY in the environment.');
    console.error('Run:  source ~/.poteau/google.env');
    process.exit(1);
}


// Nombre de placeIds à traiter
const LIMIT = 2000;

// Délai entre les requêtes (ms) pour éviter le rate limiting
const DELAY_MS = 1000;  // 1 seconde entre chaque requête

// Fichiers
const INPUT_FILE = './missingPlaceIds.json';
const OUTPUT_FILE = './fetchedLocations.json';
const ERRORS_FILE = './fetchErrors.json';

// Stats
const stats = {
  total: 0,
  success: 0,
  errors: 0,
};

// Résultats - charger les existants si présents
let results = [];
let errors = [];
const alreadyFetched = new Set();

// Charger les résultats précédents
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    results = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    results.forEach(r => alreadyFetched.add(r.placeId));
    console.log(`📂 ${results.length} résultats déjà récupérés, on reprend...`);
  } catch (e) {}
}
if (fs.existsSync(ERRORS_FILE)) {
  try {
    errors = JSON.parse(fs.readFileSync(ERRORS_FILE, 'utf8'));
    errors.forEach(e => alreadyFetched.add(e.placeId));
  } catch (e) {}
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPlaceDetails(placeId, retryCount = 0) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry&key=${GOOGLE_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.result?.geometry?.location) {
    return {
      name: data.result.name,
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
    };
  }

  // Si OVER_QUERY_LIMIT, attendre et réessayer (max 3 fois)
  if (data.status === 'OVER_QUERY_LIMIT' && retryCount < 3) {
    const waitTime = (retryCount + 1) * 2000; // 2s, 4s, 6s
    console.log(`   ⏸️  Rate limit, pause ${waitTime/1000}s...`);
    await sleep(waitTime);
    return fetchPlaceDetails(placeId, retryCount + 1);
  }

  throw new Error(data.status || 'Unknown error');
}

async function run() {
  // Vérifier la clé API
  if (GOOGLE_API_KEY === 'YOUR_GOOGLE_API_KEY') {
    console.log('❌ Erreur: Ajoute ta clé API Google dans le script !');
    console.log('   Ouvre fetchMissingLocationsFromGoogle.js');
    console.log('   Remplace YOUR_GOOGLE_API_KEY par ta vraie clé');
    process.exit(1);
  }

  console.log('🌐 Fetch des locations depuis Google Places API\n');
  console.log('='.repeat(60));

  // Charger les placeIds manquants
  const missingPlaceIds = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const toFetch = LIMIT > 0 ? missingPlaceIds.slice(0, LIMIT) : missingPlaceIds;

  console.log(`\n📋 ${toFetch.length} placeIds à traiter`);
  console.log(`💰 Coût estimé: $${(toFetch.length * 0.017).toFixed(2)}\n`);

  // Demander confirmation
  console.log('⏳ Début dans 5 secondes... (Ctrl+C pour annuler)\n');
  await sleep(5000);

  const startTime = Date.now();

  for (let i = 0; i < toFetch.length; i++) {
    const item = toFetch[i];

    // Skip si déjà traité
    if (alreadyFetched.has(item.placeId)) {
      continue;
    }

    stats.total++;

    try {
      const location = await fetchPlaceDetails(item.placeId);

      results.push({
        placeId: item.placeId,
        centreName: item.centreName,
        alertCount: item.count,
        name: location.name,
        lat: location.lat,
        lng: location.lng,
      });

      stats.success++;
    } catch (error) {
      errors.push({
        placeId: item.placeId,
        centreName: item.centreName,
        alertCount: item.count,
        error: error.message,
      });
      stats.errors++;
    }

    // Progress tous les 100
    if ((i + 1) % 100 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const pct = (((i + 1) / toFetch.length) * 100).toFixed(1);
      console.log(`   ⏳ ${i + 1}/${toFetch.length} (${pct}%) - ${stats.success} OK, ${stats.errors} erreurs - ${elapsed}s`);

      // Sauvegarder régulièrement (au cas où ça plante)
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
      fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));
    }

    // Délai entre les requêtes
    await sleep(DELAY_MS);
  }

  // Sauvegarder les résultats finaux
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));

  // Rapport
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSULTAT');
  console.log('='.repeat(60));
  console.log(`\nTotal traité: ${stats.total}`);
  console.log(`✅ Succès: ${stats.success}`);
  console.log(`❌ Erreurs: ${stats.errors}`);
  console.log(`\n⏱️  Temps: ${totalTime} minutes`);
  console.log(`\n📁 Résultats sauvegardés dans ${OUTPUT_FILE}`);

  if (stats.errors > 0) {
    console.log(`📁 Erreurs sauvegardées dans ${ERRORS_FILE}`);
  }

  // Places couvertes
  const placesCovered = results.reduce((sum, r) => sum + (missingPlaceIds.find(m => m.placeId === r.placeId)?.count || 0), 0);
  console.log(`\n🎯 Places couvertes: ${placesCovered.toLocaleString()}`);
}

run()
  .then(() => {
    console.log('\n✅ Terminé');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erreur:', err);
    // Sauvegarder ce qu'on a avant de crasher
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
    fs.writeFileSync(ERRORS_FILE, JSON.stringify(errors, null, 2));
    process.exit(1);
  });
