/**
 * Vérifie si impulstarpark ou son vrai placeId est dans cached_centres
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const IMPULSTAR_FAKE_ID = 'impulstarpark';
const IMPULSTAR_REAL_ID = 'ChIJLdkocwBh5kcR14AXaHHKBaw';

async function check() {
  console.log('🔍 Recherche dans cached_centres...\n');

  // Chercher par le faux placeId
  const fakeQuery = await db.collection('cached_centres')
    .where('centre_place_id', '==', IMPULSTAR_FAKE_ID)
    .get();

  if (!fakeQuery.empty) {
    console.log(`✅ Trouvé avec "impulstarpark":`);
    fakeQuery.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.centre_name}`);
      console.log(`   - placeId: ${data.centre_place_id}`);
      console.log(`   - location: ${data.centre_location?._latitude}, ${data.centre_location?._longitude}`);
    });
  } else {
    console.log(`❌ Pas trouvé avec "impulstarpark"`);
  }

  console.log('');

  // Chercher par le vrai placeId
  const realQuery = await db.collection('cached_centres')
    .where('centre_place_id', '==', IMPULSTAR_REAL_ID)
    .get();

  if (!realQuery.empty) {
    console.log(`✅ Trouvé avec le vrai placeId (${IMPULSTAR_REAL_ID}):`);
    realQuery.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.centre_name}`);
      console.log(`   - placeId: ${data.centre_place_id}`);
      console.log(`   - location: ${data.centre_location?._latitude}, ${data.centre_location?._longitude}`);
    });
  } else {
    console.log(`❌ Pas trouvé avec le vrai placeId (${IMPULSTAR_REAL_ID})`);
  }

  // Chercher par nom (au cas où)
  console.log('\n🔍 Recherche par nom contenant "impulstar"...');
  const allCentres = await db.collection('cached_centres').get();
  let found = false;
  allCentres.forEach(doc => {
    const data = doc.data();
    if (data.centre_name?.toLowerCase().includes('impulstar')) {
      found = true;
      console.log(`✅ Trouvé: ${data.centre_name}`);
      console.log(`   - placeId: ${data.centre_place_id}`);
    }
  });
  if (!found) {
    console.log('❌ Aucun centre avec "impulstar" dans le nom');
  }

  // Compter combien d'alertes utilisent chaque version
  console.log('\n📊 Alertes utilisant ces placeIds...');

  const alertsSnapshot = await db.collection('alerts').get();
  let fakeCount = 0;
  let realCount = 0;

  alertsSnapshot.forEach(doc => {
    const places = doc.data().places || [];
    places.forEach(place => {
      if (place.placeId === IMPULSTAR_FAKE_ID) fakeCount++;
      if (place.placeId === IMPULSTAR_REAL_ID) realCount++;
    });
  });

  console.log(`   "impulstarpark" (fake): ${fakeCount} alertes`);
  console.log(`   "${IMPULSTAR_REAL_ID}" (real): ${realCount} alertes`);

  if (fakeCount > 0) {
    console.log(`\n💡 Suggestion: Migrer les ${fakeCount} alertes de "impulstarpark" vers le vrai placeId`);
  }
}

check()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
