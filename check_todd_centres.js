const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const PLACE_IDS = [
  { name: 'Randy Johnson Park Bluff Creek Fields', placeId: 'ChIJmzdpxaKwwoARSE3B2r7v5EA' },
  { name: 'The Sports Park', placeId: 'ChIJPZi5ppGwwoARjRzePFD-SfQ' },
];

async function main() {
  for (const { name, placeId } of PLACE_IDS) {
    const snap = await db
      .collection('cached_centres')
      .where('centre_place_id', '==', placeId)
      .limit(2)
      .get();
    if (snap.empty) {
      console.log(`MISSING: ${name} (${placeId}) not in cached_centres`);
    } else {
      console.log(`OK: ${name} -> ${snap.size} cached_centres entry/entries:`);
      snap.docs.forEach((d) => {
        const v = d.data();
        console.log(
          `  - ${d.id} | centre_name="${v.centre_name}" | sports=${JSON.stringify(v.sports)} | address="${v.centre_address}"`
        );
      });
    }
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
