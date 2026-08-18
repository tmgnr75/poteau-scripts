const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const gameIds = [
  '28ded3suB5TLllZ4IqhL',
  'D5N8PfT3gsh5nPJYoMID',
  'ue1rFuNaya56DF1coY7C',
  'Nlz1orMsZT5WlVmDZS6m',
  'okl68RXsZThzbJ6eedXS',
];

async function fetchUser(ref) {
  if (!ref) return null;
  try {
    const snap = await ref.get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    return null;
  }
}

async function getUserById(uid) {
  if (!uid) return null;
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  } catch (e) {
    return null;
  }
}

async function processGame(gameId) {
  const gameSnap = await db.collection('games').doc(gameId).get();
  if (!gameSnap.exists) {
    return { gameId, error: 'Game not found' };
  }

  const game = gameSnap.data();

  // Fetch organizer
  let organizerUser = null;
  const organizerRef = game.organizer; // could be a reference
  if (organizerRef && typeof organizerRef === 'object' && organizerRef._path) {
    organizerUser = await fetchUser(organizerRef);
  } else if (typeof organizerRef === 'string') {
    organizerUser = await getUserById(organizerRef);
  }

  // Fetch attendees
  const attendeeRefs = game.attendees || [];
  const attendees = [];
  for (const ref of attendeeRefs) {
    let userData = null;
    if (ref && typeof ref === 'object' && ref._path) {
      userData = await fetchUser(ref);
    } else if (typeof ref === 'string') {
      userData = await getUserById(ref);
    }
    if (userData) {
      attendees.push({
        id: userData.id,
        display_name: userData.display_name || userData.displayName || null,
      });
    } else {
      const refId = (ref && ref._path) ? ref._path.segments[ref._path.segments.length - 1] : String(ref);
      attendees.push({ id: refId, display_name: null });
    }
  }

  // Teams
  const teams = (game.teams || []).map((t) => ({
    user_id: t.user_id || t.userId || null,
    status: t.status || null,
    team_side: t.team_side || t.teamSide || null,
    plus_one: t.plus_one || t.plusOne || false,
    position: t.position || null,
  }));

  const openTeamSlotsCount = teams.filter((t) => t.status === 'open').length;
  const maxPlayers = game.max_players || game.maxPlayers || 0;
  const missingAttendeesCount = maxPlayers - attendees.length;

  // Game date
  let dateISO = null;
  if (game.date) {
    if (game.date.toDate) {
      dateISO = game.date.toDate().toISOString();
    } else if (game.date instanceof Date) {
      dateISO = game.date.toISOString();
    } else {
      dateISO = String(game.date);
    }
  }

  // Organizer info
  const organizerUid = organizerUser ? organizerUser.id : (typeof organizerRef === 'string' ? organizerRef : null);
  const organizerDisplayName = organizerUser ? (organizerUser.display_name || organizerUser.displayName || null) : null;
  const sport = game.sport || null;
  const organizerSoccerPosition = (sport === 'soccer' || sport === 'football')
    ? (organizerUser ? (organizerUser.soccer_position || organizerUser.soccerPosition || null) : null)
    : undefined;

  const report = {
    gameId,
    status: game.status || null,
    date: dateISO,
    sport,
    type: game.type || null,
    currency: game.currency || null,
    max_players: maxPlayers,
    organizer: organizerUid,
    attendees,
    teams,
    openTeamSlotsCount,
    missingAttendeesCount,
    organizerDisplayName,
  };

  if (organizerSoccerPosition !== undefined) {
    report.organizerSoccerPosition = organizerSoccerPosition;
  }

  return report;
}

async function main() {
  const results = [];
  for (const gameId of gameIds) {
    try {
      const report = await processGame(gameId);
      results.push(report);
    } catch (e) {
      results.push({ gameId, error: e.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
