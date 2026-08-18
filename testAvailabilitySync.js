// Resolve modules from cloud-functions/functions where they're installed
const path = require('path');
const fnDir = path.resolve(__dirname, '..', 'cloud-functions', 'functions');
const admin = require(path.join(fnDir, 'node_modules', 'firebase-admin'));
const algoliasearch = require(path.join(fnDir, 'node_modules', 'algoliasearch'));

admin.initializeApp();
const db = admin.firestore();

const ALGOLIA_APP_ID = '1DB794X1LJ';
const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
if (!ALGOLIA_ADMIN_KEY) {
  console.error('ERROR: Set ALGOLIA_ADMIN_KEY environment variable');
  process.exit(1);
}

const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
const index = algoliaClient.initIndex('availabilities');

const TEST_USER_ID = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let docId = null;

async function run() {
  let passed = 0;
  let failed = 0;

  function assert(label, condition, detail) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label} — ${detail || 'FAIL'}`);
      failed++;
    }
  }

  try {
    // --- Step A: Create test document ---
    console.log('\n=== Step A: Create Firestore document ===');
    const docRef = await db.collection('availabilities').add({
      user_id: TEST_USER_ID,
      location: new admin.firestore.GeoPoint(48.85, 2.33),
      slots: ['1-19:00', '7-10:00'],
      label: 'Test sync',
    });
    docId = docRef.id;
    console.log(`  Created doc: ${docId}`);
    assert('Document created in Firestore', true);

    // --- Step B: Wait for trigger ---
    console.log('\n=== Step B: Waiting 15s for syncAvailabilityToAlgolia trigger ===');
    await sleep(15000);
    console.log('  Done waiting.');

    // --- Step C: Verify in Algolia ---
    console.log('\n=== Step C: Verify document in Algolia ===');
    let algoliaObj;
    try {
      algoliaObj = await index.getObject(docId);
    } catch (err) {
      algoliaObj = null;
    }

    assert('Object exists in Algolia', !!algoliaObj, 'Not found');
    if (algoliaObj) {
      assert('objectID matches Firestore doc ID', algoliaObj.objectID === docId,
        `expected ${docId}, got ${algoliaObj.objectID}`);
      assert('_geoloc.lat is 48.85', algoliaObj._geoloc && algoliaObj._geoloc.lat === 48.85,
        `got ${JSON.stringify(algoliaObj._geoloc)}`);
      assert('_geoloc.lng is 2.33', algoliaObj._geoloc && algoliaObj._geoloc.lng === 2.33,
        `got ${JSON.stringify(algoliaObj._geoloc)}`);
      assert('user_id is correct', algoliaObj.user_id === TEST_USER_ID,
        `got ${algoliaObj.user_id}`);
      assert('slots match', JSON.stringify(algoliaObj.slots) === JSON.stringify(['1-19:00', '7-10:00']),
        `got ${JSON.stringify(algoliaObj.slots)}`);
      assert('label is present', algoliaObj.label === 'Test sync',
        `got ${algoliaObj.label}`);
    }

    // --- Step D: Call findCompatiblePlayers ---
    console.log('\n=== Step D: Call findCompatiblePlayers ===');
    // User Wy5RXZJefwOZfAKG4MvOS6raU2f2 exists in the "users" collection,
    // so the full pipeline should work: Algolia geo match → Firestore lookup → sport filter.

    const fetch = (await import('node-fetch')).default;
    const resp = await fetch('https://europe-west1-krank-club.cloudfunctions.net/findCompatiblePlayers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          userId: 'different_user_456',
          lat: 48.85,
          lng: 2.33,
          radius: 5000,
          slots: ['1-19:00', '7-10:00'],
          sports: ['soccer'],
        }
      }),
    });
    const body = await resp.json();
    assert('findCompatiblePlayers returned 200', resp.status === 200, `status ${resp.status}`);
    assert('Response has players array', body.result && Array.isArray(body.result.players),
      JSON.stringify(body));

    const players = body.result?.players || [];
    const testPlayer = players.find(p => p.userId === TEST_USER_ID);
    console.log(`  Players returned: ${players.length}`);
    if (testPlayer) {
      console.log(`  Found test user: ${JSON.stringify(testPlayer)}`);
      assert('Test user found in results', true);
      assert('Compatibility is 100%', testPlayer.compatibility === 100,
        `got ${testPlayer.compatibility}%`);
      assert('commonSlotsCount is 2', testPlayer.commonSlotsCount === 2,
        `got ${testPlayer.commonSlotsCount}`);
      assert('firstName is present', !!testPlayer.firstName,
        `got "${testPlayer.firstName}"`);
    } else {
      console.log(`  ⚠️  Test user not in results. Players: ${JSON.stringify(players)}`);
      // Check user doc to understand why
      const userDoc = await db.collection('users').doc(TEST_USER_ID).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`  User sports: ${JSON.stringify(userData.sports)}`);
        const hasSoccer = (userData.sports || []).includes('soccer');
        if (!hasSoccer) {
          console.log('  → User does not have "soccer" in sports — filtered out by sport check');
          assert('User correctly filtered (no soccer sport)', true);
        } else {
          assert('Test user should have been found', false, 'has soccer but not returned');
        }
      } else {
        assert('User doc exists in Firestore', false, 'doc not found');
      }
    }

    // --- Step E: Clean up Firestore ---
    console.log('\n=== Step E: Delete test document from Firestore ===');
    await db.collection('availabilities').doc(docId).delete();
    console.log(`  Deleted doc: ${docId}`);
    assert('Document deleted from Firestore', true);

    // --- Step F: Verify deletion from Algolia ---
    console.log('\n=== Step F: Waiting 10s then verifying Algolia deletion ===');
    await sleep(10000);

    let deletedObj;
    try {
      deletedObj = await index.getObject(docId);
    } catch (err) {
      deletedObj = null;
    }
    assert('Object removed from Algolia', !deletedObj,
      `Still exists: ${JSON.stringify(deletedObj)}`);

  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
    failed++;
  }

  // --- Summary ---
  console.log(`\n${'='.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(40)}\n`);

  // Clean up just in case
  if (docId) {
    try { await db.collection('availabilities').doc(docId).delete(); } catch (_) {}
    try { await index.deleteObject(docId); } catch (_) {}
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
