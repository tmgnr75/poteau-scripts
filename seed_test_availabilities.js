/**
 * Poteau | seed_test_availabilities.js
 *
 * Gives every Kinshasa test account a broad `availabilities` doc so that a fresh
 * test signup ALWAYS finds compatible test players on the onboarding invite step
 * (findCompatiblePlayers matches on availability slots + geo + sport). Without
 * this, test accounts have zero availability slots, so the is_test_account
 * isolation filter returns 0 players and the invite step looks empty.
 *
 * Idempotent: writes a deterministic doc id per test account.
 *
 * Usage: node seed_test_availabilities.js [--dry-run]
 */
const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
const cfg = require(path.join(__dirname, 'agent', 'lib', 'kinshasa_test_config.js'));
const algoliasearch = require('algoliasearch');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const { GeoPoint, Timestamp } = admin.firestore;

const DRY = process.argv.includes('--dry-run');

// findCompatiblePlayers searches the ALGOLIA `availabilities` index (not Firestore
// directly), so we must push the test accounts there too.
const ALGOLIA_APP_ID = '1DB794X1LJ';
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
if (!DRY && !ALGOLIA_ADMIN_KEY) {
  console.error('ERROR: set ALGOLIA_ADMIN_KEY (firebase functions:secrets:access ALGOLIA_ADMIN_KEY --project=krank-club)');
  process.exit(2);
}
const algoliaIndex = DRY ? null : algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY).initIndex('availabilities');

// Broad slots: every day (1..7), every 30 min from 07:00 to 22:00, so any
// plausible slot a test signup picks overlaps.
function broadSlots() {
  const slots = [];
  for (let day = 1; day <= 7; day++) {
    for (let h = 7; h <= 22; h++) {
      for (const m of ['00', '30']) slots.push(`${day}-${String(h).padStart(2, '0')}:${m}`);
    }
  }
  return slots;
}

(async () => {
  const K = cfg.KINSHASA;
  const slots = broadSlots();
  console.log(`${DRY ? 'DRY-RUN' : 'LIVE'} — seeding availabilities for ${cfg.ROSTER.length} test accounts (${slots.length} slots each, Kinshasa)`);

  for (const spec of cfg.ROSTER) {
    // Only player-type accounts are relevant as compatible players.
    if (spec.role === 'pro' || spec.role === 'super_pro') { console.log(`  skip ${spec.key} (pro)`); continue; }
    const email = cfg.emailFor(spec.key);
    const u = await admin.auth().getUserByEmail(email).catch(() => null);
    if (!u) { console.log(`  (absent) ${email}`); continue; }

    const docId = `${u.uid}_kinshasa_${K.lat.toFixed(3)}_${K.lng.toFixed(3)}`;
    const doc = {
      user_id: u.uid,
      location: new GeoPoint(K.lat, K.lng),
      radius: K.radius,
      slots,
      city: K.city,
      country: K.country,
      label: K.label,
      emoji: '⚽',
      origin: 'agent-test-seed',
      created_at: DRY ? '<now>' : Timestamp.now(),
      updated_at: DRY ? '<now>' : Timestamp.now(),
    };
    // Algolia record (what findCompatiblePlayers actually searches).
    const algoliaRecord = {
      objectID: docId,
      user_id: u.uid,
      _geoloc: { lat: K.lat, lng: K.lng },
      slots,
      label: K.label,
    };
    if (DRY) {
      console.log(`  would write availabilities/${docId} (${slots.length} slots) + Algolia record + user.last_availability`);
    } else {
      await db.collection('availabilities').doc(docId).set(doc);
      await db.collection('users').doc(u.uid).update({ last_availability: docId });
      await algoliaIndex.saveObject(algoliaRecord);
      console.log(`  ✓ ${email} → Firestore + Algolia (${docId})`);
    }
  }
  console.log(DRY ? '\nDry-run only. Re-run without --dry-run to seed.' : '\nDone.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
