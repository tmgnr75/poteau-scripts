// Read-only simulation of what use_availabilities=true would have done in the
// last 24h. Zero Firestore writes. Reuses the exact shared modules used by the
// production Gen2 functions (onGamePublished.js + scheduleProInvites.js).
//
// What we simulate:
//   Path A - onGamePublished: for every game CREATED in the last 24h that
//     matches the eligibility rules, count the invitations that WOULD have
//     been created (skip-if-pro-or-repeater-AND->4d, skip-if-private,
//     skip-if-no-location, exclude attendees).
//   Path B - scheduleProInvites cron: for each half-hour tick in the last 24h,
//     find pro/repeater games with date exactly 4 days later on the hour,
//     count invitations. This matches the production 30-min cadence exactly.
//
// Cross-referenced against the actual alerts-based invitations that fired in
// the same window so we can compute delta.

const admin = require('firebase-admin');
const moment = require('moment-timezone');
const geoTz = require('geo-tz');

admin.initializeApp({
  credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
});
const db = admin.firestore();

// Reuse EXACTLY the shared modules the production CFs use so we can't drift.
const { buildCandidateSlots } = require('../cloud-functions/functions/shared/availabilityMatching');
const { getAvailabilitiesIndex } = require('../cloud-functions/functions/shared/algoliaClient');

const ALGOLIA_ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY;
if (!ALGOLIA_ADMIN_KEY) {
  console.error('ERROR: ALGOLIA_ADMIN_KEY env var required');
  process.exit(1);
}

const DEFAULT_SEARCH_RADIUS_M = 20000;
const index = getAvailabilitiesIndex(ALGOLIA_ADMIN_KEY);

// Fetches games that would have been eligible for either Path A or Path B
// during the last 24h.
async function fetchGamesInWindow(windowStart, windowEnd) {
  // Path A: games CREATED in the last 24h.
  const created24h = await db.collection('games')
    .where('created_on', '>=', windowStart)
    .where('created_on', '<=', windowEnd)
    .get();

  // Path B: games with `date` on-the-hour landing 4 days from any tick in
  // [windowStart, windowEnd]. In prod the cron uses `date == exact_timestamp`
  // every 30 min, so multiple exact queries. Here we use a range on `date`
  // AND filter type/repeater in memory to avoid needing a composite index
  // on (repeater, date). Range on `date` only + memory filter is index-free.
  const cronRangeStart = new Date(windowStart.getTime() + 4 * 24 * 60 * 60 * 1000);
  const cronRangeEnd = new Date(windowEnd.getTime() + 4 * 24 * 60 * 60 * 1000);
  const pathBcandidates = await db.collection('games')
    .where('date', '>=', cronRangeStart)
    .where('date', '<=', cronRangeEnd)
    .get();

  const pathBpro = [];
  const pathBrepeater = [];
  for (const d of pathBcandidates.docs) {
    const gd = d.data();
    if (gd.type === 'pro') pathBpro.push(d);
    if (gd.repeater != null) pathBrepeater.push(d);
  }

  return { pathA: created24h.docs, pathBpro, pathBrepeater };
}

// Mirrors onGamePublished.js eligibility check
function eligibleForPathA(gameData, now = new Date()) {
  if (gameData.visibility === 'private') return { eligible: false, reason: 'private' };
  if (gameData.status !== 'published') return { eligible: false, reason: `status=${gameData.status}` };
  if (!gameData.location || gameData.location.latitude == null || gameData.location.longitude == null) {
    return { eligible: false, reason: 'no_location' };
  }
  if (!gameData.date) return { eligible: false, reason: 'no_date' };

  // The 4-day skip rule applies to pro AND repeater games
  if (gameData.type === 'pro' || gameData.repeater) {
    const fourDaysFromNow = moment(now).add(4, 'days');
    if (moment(gameData.date.toDate()).isAfter(fourDaysFromNow)) {
      return { eligible: false, reason: 'pro_or_repeater_>4d' };
    }
  }
  return { eligible: true };
}

// Mirrors scheduleProInvites.js eligibility check
function eligibleForPathB(gameData) {
  if (gameData.status && gameData.status !== 'published') return { eligible: false, reason: `status=${gameData.status}` };
  if (gameData.visibility === 'private') return { eligible: false, reason: 'private' };
  if (!gameData.location || gameData.location.latitude == null) return { eligible: false, reason: 'no_location' };
  return { eligible: true };
}

// Runs the exact match logic: buildCandidateSlots -> Algolia -> filter -> dedup
// Returns { matchedUsers, hits, timezone, slots }
async function matchGame(gameDoc, gameData) {
  const timeZones = geoTz.find(gameData.location.latitude, gameData.location.longitude);
  const timeZone = timeZones.length > 0 ? timeZones[0] : 'Europe/Paris';
  const gameDateAdjusted = moment(gameData.date.toDate()).tz(timeZone);
  const dayOfWeek = gameDateAdjusted.day() === 0 ? 7 : gameDateAdjusted.day();
  const hours = gameDateAdjusted.hour();
  const minutes = gameDateAdjusted.minute();
  const candidateSlots = buildCandidateSlots(dayOfWeek, hours, minutes);

  if (candidateSlots.length === 0) {
    return { matchedUsers: new Map(), timezone: timeZone, slots: candidateSlots, algoliaHits: 0 };
  }

  // Attendee exclusion
  const attendeesSnapshot = await gameDoc.ref.collection('attendees').get();
  const attendeeIds = new Set(
    attendeesSnapshot.docs.map(d => d.data().user).filter(Boolean).map(ref => ref.id)
  );

  // Algolia paginated search
  const allHits = [];
  let page = 0;
  let nbPages = 1;
  while (page < nbPages) {
    const result = await index.search('', {
      aroundLatLng: `${gameData.location.latitude},${gameData.location.longitude}`,
      aroundRadius: DEFAULT_SEARCH_RADIUS_M,
      hitsPerPage: 1000,
      page,
      attributesToRetrieve: ['user_id', 'slots'],
    });
    allHits.push(...result.hits);
    nbPages = result.nbPages;
    page++;
  }

  const candidateSet = new Set(candidateSlots);
  const userToAvailability = new Map();
  for (const hit of allHits) {
    if (!hit.user_id || attendeeIds.has(hit.user_id)) continue;
    const slots = hit.slots || [];
    if (slots.some(s => candidateSet.has(s))) {
      if (!userToAvailability.has(hit.user_id)) {
        userToAvailability.set(hit.user_id, hit.objectID);
      }
    }
  }

  return {
    matchedUsers: userToAvailability,
    timezone: timeZone,
    slots: candidateSlots,
    algoliaHits: allHits.length,
  };
}

// Dedup against existing game_invitations for this game (any source)
async function dedupExisting(gameRef, userIds) {
  const existing = new Set();
  for (let i = 0; i < userIds.length; i += 30) {
    const batch = userIds.slice(i, i + 30);
    const batchRefs = batch.map(uid => db.doc(`users/${uid}`));
    const existingSnap = await db.collection('game_invitations')
      .where('game', '==', gameRef)
      .where('invitee', 'in', batchRefs)
      .get();
    existingSnap.docs.forEach(d => {
      const inviteeRef = d.data().invitee;
      if (inviteeRef && inviteeRef.id) existing.add(inviteeRef.id);
    });
  }
  return existing;
}

async function main() {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = now;

  console.log(`\n=== Simulation window ===`);
  console.log(`Start: ${windowStart.toISOString()}`);
  console.log(`End:   ${windowEnd.toISOString()}`);
  console.log('');

  // 1. Fetch actual alerts-based invitations created in this window for comparison
  console.log('Fetching actual v1 (alerts-based) invitations from window...');
  const actualInvsSnap = await db.collection('game_invitations')
    .where('created', '>=', windowStart)
    .where('created', '<=', windowEnd)
    .get();
  const actualByGame = new Map();
  const actualUniqueUsers = new Set();
  for (const doc of actualInvsSnap.docs) {
    const d = doc.data();
    const gameId = d.game?.id;
    const inviteeId = d.invitee?.id;
    if (!gameId || !inviteeId) continue;
    if (!actualByGame.has(gameId)) actualByGame.set(gameId, new Set());
    actualByGame.get(gameId).add(inviteeId);
    actualUniqueUsers.add(inviteeId);
  }
  const actualTotal = actualInvsSnap.size;
  console.log(`Actual v1 invitations in window: ${actualTotal}`);
  console.log(`Actual v1 unique games invited:  ${actualByGame.size}`);
  console.log(`Actual v1 unique users reached:  ${actualUniqueUsers.size}`);
  console.log('');

  // 2. Fetch games eligible for either path
  console.log('Fetching candidate games...');
  const { pathA, pathBpro, pathBrepeater } = await fetchGamesInWindow(windowStart, windowEnd);
  console.log(`Path A (created in 24h):                 ${pathA.length}`);
  console.log(`Path B pro (date at now+4d ± 24h):       ${pathBpro.length}`);
  console.log(`Path B repeater (date at now+4d ± 24h):  ${pathBrepeater.length}`);

  // Merge Path B, dedup by ID
  const pathBmap = new Map();
  for (const d of pathBpro) pathBmap.set(d.id, d);
  for (const d of pathBrepeater) pathBmap.set(d.id, d);

  // Some Path A games may also appear in Path B (e.g. a pro game created 24h ago
  // with date exactly at now+4d). In production they'd both run and the second
  // would dedup. Simulate the same: process each game once, note the winning path.
  const allGames = new Map();
  const gamePath = new Map(); // gameId -> 'A' | 'B' | 'both'
  for (const d of pathA) {
    allGames.set(d.id, d);
    gamePath.set(d.id, 'A');
  }
  for (const [id, d] of pathBmap.entries()) {
    if (allGames.has(id)) {
      gamePath.set(id, 'both');
    } else {
      allGames.set(id, d);
      gamePath.set(id, 'B');
    }
  }
  console.log(`Total distinct games to simulate: ${allGames.size}`);
  console.log('');

  // 3. For each game, determine which path applies, check eligibility, run match
  const results = [];
  const rejectReasons = {};
  let processed = 0;
  let matched = 0;
  let sumMatchedUsers = 0;
  let sumMatchedAfterDedup = 0;
  const simulatedByGame = new Map();
  const simulatedUniqueUsers = new Set();

  const gamesArr = [...allGames.entries()];

  for (const [gameId, gameDoc] of gamesArr) {
    processed++;
    const gameData = gameDoc.data();
    const path = gamePath.get(gameId);

    // Eligibility check per path. If a game is in "both", the create-time
    // trigger fires first, so use Path A eligibility. If Path A rejects but
    // Path B would accept, Path B still fires later (cron picks it up), so
    // fall through.
    let elig;
    let effectivePath = path;
    if (path === 'A' || path === 'both') {
      elig = eligibleForPathA(gameData, gameData.created_on?.toDate?.() || windowStart);
      if (!elig.eligible && (path === 'both')) {
        // Try Path B
        const elig2 = eligibleForPathB(gameData);
        if (elig2.eligible) { elig = elig2; effectivePath = 'B'; }
      }
    } else {
      elig = eligibleForPathB(gameData);
    }

    if (!elig.eligible) {
      rejectReasons[elig.reason] = (rejectReasons[elig.reason] || 0) + 1;
      continue;
    }

    // Run the match
    let matchResult;
    try {
      matchResult = await matchGame(gameDoc, gameData);
    } catch (err) {
      rejectReasons['match_error'] = (rejectReasons['match_error'] || 0) + 1;
      console.error(`[${gameId}] match error:`, err.message);
      continue;
    }

    const matchedUsers = matchResult.matchedUsers;
    sumMatchedUsers += matchedUsers.size;
    if (matchedUsers.size === 0) continue;

    // Dedup against existing invitations for this game (regardless of source —
    // the production dedup is by game+invitee, not by source, so if a v1 alert
    // already invited the user, v2 wouldn't create a duplicate)
    const existing = await dedupExisting(gameDoc.ref, [...matchedUsers.keys()]);
    let netNew = 0;
    for (const uid of matchedUsers.keys()) {
      if (!existing.has(uid)) {
        netNew++;
        simulatedUniqueUsers.add(uid);
      }
    }
    sumMatchedAfterDedup += netNew;
    if (netNew > 0) matched++;

    simulatedByGame.set(gameId, {
      matched_before_dedup: matchedUsers.size,
      matched_after_dedup: netNew,
      already_existing: existing.size,
      path: effectivePath,
      algolia_hits: matchResult.algoliaHits,
      timezone: matchResult.timezone,
      slots: matchResult.slots,
      centre: gameData.centre || '(none)',
      place_id: gameData.place_id || null,
      type: gameData.type || '(none)',
      sport: gameData.sport || '(none)',
      is_repeater: !!gameData.repeater,
      date: gameData.date?.toDate?.()?.toISOString(),
      max_players: gameData.max_players,
      payment_type: gameData.payment_type,
    });

    if (processed % 25 === 0) {
      console.log(`  ...processed ${processed}/${gamesArr.length} (matched ${matched}, cum sim invites ${sumMatchedAfterDedup})`);
    }
  }

  console.log('');
  console.log('=== SIMULATION COMPLETE ===');
  console.log(`Games processed: ${processed}`);
  console.log(`Games with >=1 matched user: ${matched}`);
  console.log('');
  console.log(`Simulated v2 invitations (before dedup): ${sumMatchedUsers}`);
  console.log(`Simulated v2 invitations (after dedup):  ${sumMatchedAfterDedup}`);
  console.log(`Simulated v2 unique users reached:       ${simulatedUniqueUsers.size}`);
  console.log('');
  console.log(`Actual v1 invitations sent:              ${actualTotal}`);
  console.log(`Actual v1 unique users reached:          ${actualUniqueUsers.size}`);
  console.log('');

  // 4. Deltas
  const delta = sumMatchedAfterDedup - actualTotal;
  const deltaPct = actualTotal > 0 ? (delta / actualTotal * 100).toFixed(1) : 'N/A';
  console.log(`Delta invitations: ${delta > 0 ? '+' : ''}${delta} (${deltaPct}%)`);
  const usersOverlap = new Set([...simulatedUniqueUsers].filter(u => actualUniqueUsers.has(u)));
  console.log(`User overlap: ${usersOverlap.size} users would have received an invite from BOTH systems`);
  console.log(`Users only reached by v2 (net new): ${simulatedUniqueUsers.size - usersOverlap.size}`);
  console.log(`Users only reached by v1 (would lose): ${actualUniqueUsers.size - usersOverlap.size}`);
  console.log('');

  // 5. Reject reasons
  if (Object.keys(rejectReasons).length > 0) {
    console.log('Ineligibility reasons (why games were skipped):');
    for (const [r, n] of Object.entries(rejectReasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${r}: ${n}`);
    }
    console.log('');
  }

  // 6. Distribution histogram
  const buckets = { '0': 0, '1-5': 0, '6-20': 0, '21-50': 0, '51-100': 0, '101-500': 0, '501+': 0 };
  for (const info of simulatedByGame.values()) {
    const n = info.matched_after_dedup;
    if (n === 0) buckets['0']++;
    else if (n <= 5) buckets['1-5']++;
    else if (n <= 20) buckets['6-20']++;
    else if (n <= 50) buckets['21-50']++;
    else if (n <= 100) buckets['51-100']++;
    else if (n <= 500) buckets['101-500']++;
    else buckets['501+']++;
  }
  console.log('Simulated invitations per game (after dedup):');
  for (const [k, v] of Object.entries(buckets)) console.log(`  ${k}: ${v} games`);
  console.log('');

  // 7. Qualitative samples
  const sortedByV2 = [...simulatedByGame.entries()].sort((a, b) => b[1].matched_after_dedup - a[1].matched_after_dedup);

  const samples = [];
  // Top 3 by v2 invitations
  for (const [gid, info] of sortedByV2.slice(0, 3)) {
    samples.push({ label: 'HIGH v2 volume', gameId: gid, ...info, actual_v1: (actualByGame.get(gid)?.size ?? 0) });
  }
  // Biggest positive delta (v2 way more than v1)
  const withDelta = [...simulatedByGame.entries()].map(([gid, info]) => ({
    gameId: gid,
    info,
    v1: actualByGame.get(gid)?.size ?? 0,
    delta: info.matched_after_dedup - (actualByGame.get(gid)?.size ?? 0),
  }));
  withDelta.sort((a, b) => b.delta - a.delta);
  for (const s of withDelta.slice(0, 3)) {
    samples.push({ label: 'BIGGEST +delta vs v1', gameId: s.gameId, ...s.info, actual_v1: s.v1, delta: s.delta });
  }
  // Biggest negative delta (v1 way more than v2)
  withDelta.sort((a, b) => a.delta - b.delta);
  for (const s of withDelta.slice(0, 3)) {
    samples.push({ label: 'BIGGEST -delta vs v1', gameId: s.gameId, ...s.info, actual_v1: s.v1, delta: s.delta });
  }
  // v2 == 0 but v1 was high
  const v1HighV2Zero = [...actualByGame.entries()]
    .filter(([gid, users]) => users.size > 50 && (simulatedByGame.get(gid)?.matched_after_dedup ?? 0) === 0)
    .sort((a, b) => b[1].size - a[1].size);
  for (const [gid, users] of v1HighV2Zero.slice(0, 3)) {
    const info = simulatedByGame.get(gid);
    samples.push({
      label: 'V1 sent many, V2 sent 0',
      gameId: gid,
      actual_v1: users.size,
      info_sim: info || '(not simulated — game not in eligible set)',
    });
  }

  console.log('=== QUALITATIVE SAMPLES ===\n');
  for (const s of samples) {
    console.log(`[${s.label}] ${s.gameId}`);
    if (s.centre !== undefined) console.log(`  centre: ${s.centre}, type=${s.type}, sport=${s.sport}, repeater=${s.is_repeater}, path=${s.path}`);
    if (s.date) console.log(`  game date: ${s.date} (${s.timezone})`);
    if (s.slots) console.log(`  candidate slots: ${s.slots?.join(',')}`);
    if (s.matched_before_dedup !== undefined) {
      console.log(`  v2 matched: ${s.matched_before_dedup} raw, ${s.matched_after_dedup} after dedup (existing=${s.already_existing}, Algolia hits=${s.algolia_hits})`);
    }
    console.log(`  v1 (actual): ${s.actual_v1}`);
    if (s.delta !== undefined) console.log(`  delta: ${s.delta > 0 ? '+' : ''}${s.delta}`);
    if (s.info_sim && typeof s.info_sim === 'string') console.log(`  sim status: ${s.info_sim}`);
    console.log('');
  }

  process.exit(0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
