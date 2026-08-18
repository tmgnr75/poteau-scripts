// Quality comparison of v1 (alerts) vs v2 (availabilities) invitations, on the
// SAME 100 games sampled from real production.
//
// For each game, we compute:
//   - v1 invitees (actual game_invitations from source != "availabilities")
//   - v2 invitees (simulated via the same shared modules the prod CFs use)
//   - Overlap, v1-only, v2-only sets
//   - Quality metric per set: what % of the invitees have STATED AVAILABILITY
//     that matches the game's day-of-week + hour + 20km radius?
//
// The stated-availability check is exactly what v2 tests: a user "should have
// been invited" if their availability slot matches. That's the ground truth.

const admin = require('firebase-admin');
const moment = require('moment-timezone');
const geoTz = require('geo-tz');

admin.initializeApp({
  credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
});
const db = admin.firestore();

const { buildCandidateSlots } = require('../cloud-functions/functions/shared/availabilityMatching');
const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');

const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
if (!ALGOLIA_ADMIN_KEY) { console.error('ERROR: ALGOLIA_ADMIN_KEY env var required'); process.exit(1); }

const DEFAULT_SEARCH_RADIUS_M = 20000;
const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

// -----------------------------------------------------------------------------
// STEP 1: Pick a diverse 100-game sample from the last 24h
// -----------------------------------------------------------------------------
async function sampleGames() {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const snap = await db.collection('games')
    .where('created_on', '>=', h24)
    .get();

  const eligible = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    // Only games we can realistically evaluate: has location, has date, is published,
    // not private. Otherwise both v1 and v2 skip them and it's not informative.
    if (!d.location || d.location.latitude == null) continue;
    if (!d.date) continue;
    if (d.visibility === 'private') continue;
    if (d.status !== 'published') continue;
    eligible.push(doc);
  }

  console.log(`Total eligible games from last 24h: ${eligible.length}`);

  // Stratified sample: proportional to type and sport, plus a mix of sizes.
  // Deterministic (seed by doc id) so results are reproducible.
  eligible.sort((a, b) => a.id.localeCompare(b.id));

  if (eligible.length <= 100) return eligible;

  // Even step sampling gives us a diverse spread across all games.
  const step = eligible.length / 100;
  const sample = [];
  for (let i = 0; i < 100; i++) {
    sample.push(eligible[Math.floor(i * step)]);
  }
  return sample;
}

// -----------------------------------------------------------------------------
// STEP 2: Compute the game's candidate slots (day-of-week + hour window)
// -----------------------------------------------------------------------------
function computeCandidateSlots(gameData) {
  const timeZones = geoTz.find(gameData.location.latitude, gameData.location.longitude);
  const timeZone = timeZones.length > 0 ? timeZones[0] : 'Europe/Paris';
  const dt = moment(gameData.date.toDate()).tz(timeZone);
  const dayOfWeek = dt.day() === 0 ? 7 : dt.day();
  return {
    slots: buildCandidateSlots(dayOfWeek, dt.hour(), dt.minute()),
    timezone: timeZone,
    dayOfWeek,
    hour: dt.hour(),
  };
}

// -----------------------------------------------------------------------------
// STEP 3: v2 simulation — get the set of users v2 WOULD invite
// -----------------------------------------------------------------------------
async function simulateV2(gameDoc, gameData, candidateSlots) {
  if (candidateSlots.length === 0) return new Set();

  // We deliberately do NOT apply the CF's skip-if-full guard here. This is a
  // retrospective sim: games in the last 24h have their attendees populated as
  // they fill over time. A game that's 10/10 now was 1/10 at creation, when
  // the CF actually would have fired. Applying the guard on current-state data
  // gives a false "v2 sent 0" for games that in reality would have generated
  // invites at creation. The CF still keeps the guard for real-time firing.

  const attendeesSnapshot = await gameDoc.ref.collection('attendees').get();
  const attendeeIds = new Set(
    attendeesSnapshot.docs.map(d => d.data().user).filter(Boolean).map(ref => ref.id)
  );

  // Algolia — mirrors the deployed CF exactly: facet filter pushes the slot
  // match server-side, so we retrieve only users whose availability contains
  // one of the candidate slots.
  const slotFilter = candidateSlots.map(s => `slots:${s}`);
  const allHits = [];
  let page = 0, nbPages = 1;
  while (page < nbPages) {
    const result = await index.search('', {
      aroundLatLng: `${gameData.location.latitude},${gameData.location.longitude}`,
      aroundRadius: DEFAULT_SEARCH_RADIUS_M,
      facetFilters: [slotFilter],
      hitsPerPage: 1000,
      page,
      attributesToRetrieve: ['user_id'],
    });
    allHits.push(...result.hits);
    nbPages = result.nbPages;
    page++;
  }

  const v2Users = new Set();
  for (const hit of allHits) {
    if (!hit.user_id || attendeeIds.has(hit.user_id)) continue;
    v2Users.add(hit.user_id);
  }
  return v2Users;
}

// -----------------------------------------------------------------------------
// STEP 4: v1 actual — pull invitations from Firestore for this game
// -----------------------------------------------------------------------------
async function fetchV1Invitees(gameDoc) {
  const snap = await db.collection('game_invitations')
    .where('game', '==', gameDoc.ref)
    .get();
  const v1Users = new Set();
  for (const doc of snap.docs) {
    const d = doc.data();
    // v1 = alerts-source. v2 in prod would tag `source: "availabilities"`.
    // Currently only v1 runs, so effectively all invitations count as v1.
    // But if some source="availabilities" already exist (e.g. from test runs),
    // exclude them.
    if (d.source === 'availabilities') continue;
    if (d.invitee?.id) v1Users.add(d.invitee.id);
  }
  return v1Users;
}

// -----------------------------------------------------------------------------
// STEP 5: For a given user set, compute what % have a MATCHING availability
// (day-of-week + hour ±20min slot AND location within 20km of the game).
// This is the "should have been invited" question, answered strictly by
// STATED AVAILABILITY (the criterion Tim picked).
// -----------------------------------------------------------------------------
async function batchCheckAvailability(userIds, gameData, candidateSlots) {
  if (userIds.length === 0) return { matched: 0, total: 0, matchedIds: [] };

  const candidateSet = new Set(candidateSlots);
  const gameLat = gameData.location.latitude;
  const gameLng = gameData.location.longitude;

  // Query availabilities in batches. Filter by user_id in batches of 30 (Firestore max).
  let matched = 0;
  const matchedIds = [];

  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const snap = await db.collection('availabilities').where('user_id', 'in', batch).get();

    // A user matches if ANY of their availability docs has (a) a slot in candidateSet
    // AND (b) location within 20km of the game (matches the Algolia geo filter
    // v2 uses at match time).
    const userMatches = new Set();
    for (const doc of snap.docs) {
      const d = doc.data();
      const uid = d.user_id;
      if (userMatches.has(uid)) continue;

      // Slot check
      const slots = d.slots || [];
      if (!slots.some(s => candidateSet.has(s))) continue;

      // Location check (haversine, quick approx)
      const availLat = d.location?.latitude;
      const availLng = d.location?.longitude;
      if (availLat == null || availLng == null) continue;
      const distM = haversineMeters(gameLat, gameLng, availLat, availLng);

      // Users have a stated `radius` on their availability doc. If present, use
      // it (proxy: they said "I'm willing to travel N meters"). Otherwise fall
      // back to the v2 CF's default search radius.
      const userRadius = d.radius || DEFAULT_SEARCH_RADIUS_M;
      if (distM > userRadius) continue;

      userMatches.add(uid);
    }
    matched += userMatches.size;
    for (const uid of userMatches) matchedIds.push(uid);
  }

  return { matched, total: userIds.length, matchedIds };
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------
async function main() {
  console.log('\n=== v1 vs v2 QUALITY COMPARISON (stated availability rubric) ===\n');
  console.log('Sampling 100 games from last 24h...');
  const sample = await sampleGames();
  console.log(`Got ${sample.length} sample games\n`);

  const perGame = [];
  const aggregate = {
    overlap: { total: 0, matchAvailability: 0 },
    v1_only: { total: 0, matchAvailability: 0 },
    v2_only: { total: 0, matchAvailability: 0 },
  };

  for (let i = 0; i < sample.length; i++) {
    const gameDoc = sample[i];
    const gameData = gameDoc.data();
    const { slots, timezone, dayOfWeek, hour } = computeCandidateSlots(gameData);

    try {
      const [v2Users, v1Users] = await Promise.all([
        simulateV2(gameDoc, gameData, slots),
        fetchV1Invitees(gameDoc),
      ]);

      // Set arithmetic
      const overlap = [...v1Users].filter(u => v2Users.has(u));
      const v1Only = [...v1Users].filter(u => !v2Users.has(u));
      const v2Only = [...v2Users].filter(u => !v1Users.has(u));

      // Quality check: what % of each set has matching stated availability?
      // The overlap and v2-only will trivially be 100% for v2 (by construction),
      // but the overlap group's v1 side and the v1-only group are the interesting
      // ones. So we check v1-only strictly + overlap for validation + v2-only
      // for validation.
      const [overlapQ, v1OnlyQ, v2OnlyQ] = await Promise.all([
        batchCheckAvailability(overlap, gameData, slots),
        batchCheckAvailability(v1Only, gameData, slots),
        batchCheckAvailability(v2Only, gameData, slots),
      ]);

      aggregate.overlap.total += overlapQ.total;
      aggregate.overlap.matchAvailability += overlapQ.matched;
      aggregate.v1_only.total += v1OnlyQ.total;
      aggregate.v1_only.matchAvailability += v1OnlyQ.matched;
      aggregate.v2_only.total += v2OnlyQ.total;
      aggregate.v2_only.matchAvailability += v2OnlyQ.matched;

      perGame.push({
        gameId: gameDoc.id,
        centre: gameData.centre,
        sport: gameData.sport,
        type: gameData.type,
        date: gameData.date.toDate().toISOString(),
        timezone,
        dayOfWeek,
        hour,
        v1Count: v1Users.size,
        v2Count: v2Users.size,
        overlap: overlap.length,
        v1OnlyCount: v1Only.length,
        v2OnlyCount: v2Only.length,
        overlapQuality: overlapQ,
        v1OnlyQuality: v1OnlyQ,
        v2OnlyQuality: v2OnlyQ,
      });

      if ((i + 1) % 10 === 0) {
        console.log(`Progress: ${i+1}/${sample.length}  (last: ${gameDoc.id} v1=${v1Users.size} v2=${v2Users.size} v1only=${v1Only.length} v2only=${v2Only.length})`);
      }
    } catch (err) {
      console.error(`[${gameDoc.id}] error: ${err.message}`);
    }
  }

  // -----------------------------------------------------------------------------
  // Report
  // -----------------------------------------------------------------------------
  console.log('\n\n=== AGGREGATE RESULTS ===\n');

  const pct = (m, t) => t > 0 ? (100 * m / t).toFixed(1) + '%' : 'n/a';

  console.log('QUALITY OF EACH GROUP (% who have matching stated availability):');
  console.log('  Users in BOTH v1 and v2:');
  console.log(`    total: ${aggregate.overlap.total}, matching-availability: ${aggregate.overlap.matchAvailability} (${pct(aggregate.overlap.matchAvailability, aggregate.overlap.total)})`);
  console.log('  Users in V1 ONLY (v2 would drop):');
  console.log(`    total: ${aggregate.v1_only.total}, matching-availability: ${aggregate.v1_only.matchAvailability} (${pct(aggregate.v1_only.matchAvailability, aggregate.v1_only.total)})`);
  console.log('  Users in V2 ONLY (v2 would add):');
  console.log(`    total: ${aggregate.v2_only.total}, matching-availability: ${aggregate.v2_only.matchAvailability} (${pct(aggregate.v2_only.matchAvailability, aggregate.v2_only.total)})`);

  console.log('\n=== INTERPRETATION ===');
  console.log('  Overlap match rate = "v2 correctly kept these" sanity check.');
  console.log('  V1-only match rate = "v1 sent to users who did NOT have stated availability".');
  console.log('     If low, v2 is right to drop them.');
  console.log('     If high, v2 has a coverage gap (real users v2 misses).');
  console.log('  V2-only match rate = "v2 sent to users v1 missed". Should be ~100%.');

  // Distribution of per-game rates for the key question
  const v1OnlyRates = perGame
    .filter(g => g.v1OnlyQuality.total > 0)
    .map(g => g.v1OnlyQuality.matched / g.v1OnlyQuality.total);
  v1OnlyRates.sort((a, b) => a - b);
  console.log(`\nPer-game v1-only match rate distribution (${v1OnlyRates.length} games with v1-only users):`);
  console.log(`  min: ${(v1OnlyRates[0]*100).toFixed(1)}%`);
  console.log(`  p25: ${(v1OnlyRates[Math.floor(v1OnlyRates.length*0.25)]*100).toFixed(1)}%`);
  console.log(`  p50: ${(v1OnlyRates[Math.floor(v1OnlyRates.length*0.5)]*100).toFixed(1)}%`);
  console.log(`  p75: ${(v1OnlyRates[Math.floor(v1OnlyRates.length*0.75)]*100).toFixed(1)}%`);
  console.log(`  max: ${(v1OnlyRates[v1OnlyRates.length-1]*100).toFixed(1)}%`);
  console.log(`  mean: ${(v1OnlyRates.reduce((a,b)=>a+b,0)/v1OnlyRates.length*100).toFixed(1)}%`);

  // Games where v2 would drop many high-quality users
  perGame.sort((a, b) => (b.v1OnlyQuality.matched) - (a.v1OnlyQuality.matched));
  console.log('\n=== 5 GAMES WHERE V2 DROPS THE MOST "SHOULD-HAVE-BEEN-INVITED" USERS ===');
  for (const g of perGame.slice(0, 5)) {
    console.log(`  ${g.gameId} @ ${g.centre} (${g.sport}, ${g.type})  D${g.dayOfWeek}-${g.hour}:00`);
    console.log(`    v1: ${g.v1Count}, v2: ${g.v2Count}, overlap: ${g.overlap}`);
    console.log(`    v1-only: ${g.v1OnlyCount} (matching-avail: ${g.v1OnlyQuality.matched}, ${pct(g.v1OnlyQuality.matched, g.v1OnlyQuality.total)})`);
    console.log(`    v2-only: ${g.v2OnlyCount} (matching-avail: ${g.v2OnlyQuality.matched}, ${pct(g.v2OnlyQuality.matched, g.v2OnlyQuality.total)})`);
  }

  // Best-case games for v2
  perGame.sort((a, b) => b.v2OnlyCount - a.v2OnlyCount);
  console.log('\n=== 5 GAMES WHERE V2 ADDS THE MOST NEW HIGH-QUALITY USERS ===');
  for (const g of perGame.slice(0, 5)) {
    console.log(`  ${g.gameId} @ ${g.centre} (${g.sport}, ${g.type})  D${g.dayOfWeek}-${g.hour}:00`);
    console.log(`    v1: ${g.v1Count}, v2: ${g.v2Count}`);
    console.log(`    v2-only (net new): ${g.v2OnlyCount} (matching-avail: ${g.v2OnlyQuality.matched}, ${pct(g.v2OnlyQuality.matched, g.v2OnlyQuality.total)})`);
  }

  process.exit(0);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
