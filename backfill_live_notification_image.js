/**
 * Backfill the Poteau Live pulsing-dot image onto existing Live connect docs.
 *
 * The notification centre reads `picture` live from Firestore
 * (notification_item_widget.dart), so rewriting it changes what players see the
 * next time they open the tab. Pushes already delivered are untouchable and are
 * NOT what this fixes.
 *
 * Only Live rows are touched, matched on `source`, which is the field
 * notifyLiveKickoff.js sets per tier. `type` would also work but is localised
 * downstream; `source` is the stable machine key.
 *
 * DRY BY DEFAULT. Pass --write to commit.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const LIVE_IMAGE =
  'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/' +
  'images%2Fpoteau_live_dot_v2.gif?alt=media&token=1fbb5371-fdcc-4cf9-81e6-7f1bea45c8bb';

// The two tiers in gen2/notifyLiveKickoff.js.
const LIVE_SOURCES = ['notify_live_ready', 'notify_live_kickoff'];

const WRITE = process.argv.includes('--write');

async function run() {
  let total = 0;
  let toChange = 0;
  const perSource = {};

  for (const source of LIVE_SOURCES) {
    const snap = await db.collection('connect').where('source', '==', source).get();
    perSource[source] = { found: snap.size, changing: 0, already: 0 };
    total += snap.size;

    // Batched in 400s: the 500 limit is per batch, and leaving headroom means
    // one oversized doc cannot fail the whole commit.
    let batch = db.batch();
    let inBatch = 0;

    for (const doc of snap.docs) {
      if (doc.get('picture') === LIVE_IMAGE) {
        perSource[source].already++;
        continue;
      }
      perSource[source].changing++;
      toChange++;

      if (WRITE) {
        // `hash_pic` is the blurhash placeholder for the OLD photo. Left in
        // place it would flash a face-shaped blur before the dot loads, so it
        // is cleared alongside the image it describes.
        batch.update(doc.ref, { picture: LIVE_IMAGE, hash_pic: '' });
        inBatch++;
        if (inBatch === 400) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
        }
      }
    }

    if (WRITE && inBatch > 0) await batch.commit();
  }

  console.log(WRITE ? '=== WROTE ===' : '=== DRY RUN (pass --write to commit) ===');
  for (const [src, c] of Object.entries(perSource)) {
    console.log(`${src}: ${c.found} found, ${c.changing} to change, ${c.already} already correct`);
  }
  console.log(`total connect docs matched: ${total}`);
  console.log(`total ${WRITE ? 'updated' : 'would update'}: ${toChange}`);
}

run().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
