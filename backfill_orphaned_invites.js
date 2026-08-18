// Backfill invitations for pro/repeater games that missed their T-4d cron tick
// during the scheduleProInvites index-crash outage (2026-07-03 → 2026-07-15).
//
// Scope: games where
//   - date is in [now+3h, now+4d]     (still can be joined; not too close to kickoff)
//   - status == 'published'
//   - type == 'pro' OR repeater != null
//   - 0 game_invitations rows currently exist for the game
//
// For each eligible game: run the same v1 alerts-based matching that
// scheduleProInvites uses, create the game_invitations docs. The push
// throttle downstream (max_invitation_pushes_per_day=3) still applies —
// users won't get spammed on their phones.
//
// Modes:
//   dry-run (default): print what WOULD be invited per game. No writes.
//   commit: actually write the game_invitations docs. Pass --commit.
//   single: only process one game by ID. Pass --game=<gameId>.

const admin = require('firebase-admin');
const moment = require('moment-timezone');
const geoTz = require('geo-tz');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const singleArg = process.argv.find(a => a.startsWith('--game='));
const SINGLE_GAME_ID = singleArg ? singleArg.split('=')[1] : null;

async function fetchEligibleGames() {
  const now = new Date();
  // Per Tim: no invites for games happening in the next 2h; no past games.
  // Upper bound: games happening through 2026-07-19 end-of-day Paris.
  // Rationale: the scheduleProInvites cron only fires at T-4d exactly. The
  // outage ran 2026-07-03 → 2026-07-15 08:00 UTC. Games whose T-4d fell inside
  // that window are orphaned; games with T-4d after 2026-07-15 08:00 got
  // invited normally by the healthy cron. Today is 2026-07-17.
  //   Game date 2026-07-18 → T-4d = 2026-07-14 (in outage) → orphaned
  //   Game date 2026-07-19 → T-4d = 2026-07-15 (edge; some orphaned pre-08:00)
  //   Game date 2026-07-20 → T-4d = 2026-07-16 (healthy cron ran) → skip
  // So this backfill only touches games between now+2h and 2026-07-19 23:59.
  const in2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const endOfJul19Paris = new Date('2026-07-19T21:59:59Z'); // 23:59 Paris = 21:59 UTC

  // Query: date range only; filter type/repeater in memory (avoids the same
  // composite-index issue that caused the outage).
  const snap = await db.collection('games')
    .where('date', '>=', in2h)
    .where('date', '<=', endOfJul19Paris)
    .get();

  const candidates = [];
  for (const doc of snap.docs) {
    const g = doc.data();
    if (g.status !== 'published') continue;
    if (g.visibility === 'private') continue;
    if (!g.location || g.location.latitude == null) continue;
    if (g.type !== 'pro' && !g.repeater) continue;
    // Skip full games
    const attendeesCount = Array.isArray(g.attendees) ? g.attendees.length : 0;
    if (g.max_players != null && attendeesCount >= g.max_players) continue;
    candidates.push(doc);
  }
  return candidates;
}

async function hasInvitations(gameRef) {
  const inv = await db.collection('game_invitations').where('game', '==', gameRef).limit(1).get();
  return !inv.empty;
}

async function findAlertMatches(gameData) {
  const timeZones = geoTz.find(gameData.location.latitude, gameData.location.longitude);
  const timeZone = timeZones.length > 0 ? timeZones[0] : 'Europe/Paris';
  const gameDateAdjusted = moment(gameData.date.toDate()).tz(timeZone);
  const weekday = gameDateAdjusted.isoWeekday();
  const timeStr = gameDateAdjusted.format('HH:mm');

  // Mirror scheduleProInvites (Gen1) matching logic
  const alertsSnap = await db.collection('alerts')
    .where('times', 'array-contains', timeStr)
    .get();

  const matchedAlertIds = [];
  const alertUserRefs = new Map(); // uid -> alertId (first match wins)

  for (const alertDoc of alertsSnap.docs) {
    const a = alertDoc.data();
    const weekdays = a.weekdays || [];
    if (!weekdays.includes(weekday)) continue;
    const places = a.places || [];
    let placeMatch = false;
    for (const place of places) {
      if ((gameData.place_id && place.placeId === gameData.place_id) ||
          (gameData.centre && place.centre === gameData.centre)) {
        placeMatch = true;
        break;
      }
    }
    if (!placeMatch) continue;
    matchedAlertIds.push(alertDoc.id);
    const uid = a.user?.id;
    if (uid && !alertUserRefs.has(uid)) alertUserRefs.set(uid, alertDoc.id);
  }
  return { weekday, timeStr, timeZone, matchedAlertIds, userToAlert: alertUserRefs };
}

async function processGame(gameDoc) {
  const gameData = gameDoc.data();
  const gameId = gameDoc.id;
  const already = await hasInvitations(gameDoc.ref);
  if (already) return { gameId, skip: 'already has invitations' };

  const match = await findAlertMatches(gameData);
  const attendeeIds = new Set((gameData.attendees || []).map(r => r?.id).filter(Boolean));

  // Filter out organizer + attendees + existing invitees (already-checked)
  const orgId = gameData.organizer;
  const finalUsers = [];
  for (const [uid, alertId] of match.userToAlert.entries()) {
    if (uid === orgId) continue;
    if (attendeeIds.has(uid)) continue;
    finalUsers.push({ uid, alertId });
  }

  const dt = gameData.date.toDate();
  console.log(`\n[${gameId}] ${gameData.centre} | ${dt.toLocaleString('fr-FR', {timeZone:'Europe/Paris'})} Paris`);
  console.log(`  weekday=${match.weekday} time=${match.timeStr} tz=${match.timeZone}`);
  console.log(`  organizer=${orgId} attendees=${attendeeIds.size}/${gameData.max_players}`);
  console.log(`  alerts matched: ${match.matchedAlertIds.length}`);
  console.log(`  invitees (after excl): ${finalUsers.length}`);

  if (finalUsers.length === 0) return { gameId, wrote: 0 };

  if (!COMMIT) {
    console.log(`  [DRY-RUN] would create ${finalUsers.length} game_invitations`);
    return { gameId, wouldWrite: finalUsers.length };
  }

  // Write in batches of 500 (Firestore limit)
  let wrote = 0;
  for (let i = 0; i < finalUsers.length; i += 500) {
    const chunk = finalUsers.slice(i, i + 500);
    const batch = db.batch();
    for (const { uid, alertId } of chunk) {
      const ref = db.collection('game_invitations').doc();
      batch.set(ref, {
        game: gameDoc.ref,
        invitee: db.collection('users').doc(uid),
        inviter: db.collection('users').doc(orgId),
        source: 'alerts',
        alert: db.collection('alerts').doc(alertId),
        status: 'pending',
        created: admin.firestore.FieldValue.serverTimestamp(),
        game_date: gameData.date,
      });
      wrote++;
    }
    await batch.commit();
  }
  console.log(`  [COMMIT] created ${wrote} invitations`);
  return { gameId, wrote };
}

(async () => {
  console.log(`Mode: ${COMMIT ? 'COMMIT (writes)' : 'DRY-RUN (no writes)'}`);
  if (SINGLE_GAME_ID) console.log(`Single game: ${SINGLE_GAME_ID}`);

  let games;
  if (SINGLE_GAME_ID) {
    const doc = await db.collection('games').doc(SINGLE_GAME_ID).get();
    if (!doc.exists) { console.log('Game not found'); process.exit(1); }
    games = [doc];
  } else {
    games = await fetchEligibleGames();
    console.log(`Found ${games.length} eligible pro/repeater games in [now+3h, now+4d]`);
  }

  let totalWrote = 0;
  let gamesTouched = 0;
  for (const doc of games) {
    const r = await processGame(doc);
    if (r.wrote || r.wouldWrite) {
      totalWrote += (r.wrote || r.wouldWrite);
      gamesTouched++;
    }
  }
  console.log(`\n=== SUMMARY ===`);
  console.log(`Games processed: ${games.length}`);
  console.log(`Games with new invitations: ${gamesTouched}`);
  console.log(`Total invitations ${COMMIT ? 'written' : 'that would be written'}: ${totalWrote}`);
  process.exit(0);
})();
