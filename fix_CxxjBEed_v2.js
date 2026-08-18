// Fix CxxjBEed2OTKFTNN0WBX properly this time.
// Write teams AND attendees in a single update so updateTeamsAttendees
// onUpdate trigger sees consistent state and doesn't rebuild.
//
// Ground truth: 10 real attendees derived from captured payments (Ayoub capped
// at 3 spots — his 4th capture will be manually refunded on Stripe).

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

const GAME_ID = 'CxxjBEed2OTKFTNN0WBX';
const COMMIT = process.argv.includes('--commit');

(async () => {
  const gameRef = db.collection('games').doc(GAME_ID);
  const g = (await gameRef.get()).data();
  const maxPlayers = g.max_players || 10;
  const currentTeams = g.teams || [];

  // Users in truth order (from the earlier investigation)
  // Format: [uid, spots]
  // Deduplication of double-tap captures:
  //   Ayoub: 4 captures, only 3 real spots (paid 3x within 61s — 1 to refund)
  //   VOLCANO YT: 2 captures for 1 spot (double-tap 2 sec apart — 1 to refund)
  // Total: 10 real attendees fitting in 10 slots. Chat confirms this
  // ('axR27... 9/10' at 15:18, then VOLCANO YT paid at 15:24 = 10/10).
  const attendeeSpec = [
    ['96jHhwxo8FewE0AOzSM7ePMXVaH2', 3],  // Ayoub + 2 friends
    // xC1j8RWMqrhkdHzIa73sMditJHD2 paid 8 EUR but is NOT in the current
    // attendees array — likely reserved, paid, then removed themselves or
    // was auto-removed. Their captured payment needs manual refund on Stripe.
    ['OnHsxh7dZHPr2OKwjjC2Y5wf0qH3', 1],  // VOLCANO YT (1 spot, was double-tapped)
    ['3KxNC86KWwWHKddcrM6duGaJATi2', 1],  // alexandre khoury
    ['6yal1GzoRyZFap1iy0BoWn6hpfk2', 1],  // Marlon
    ['QAogqEt4YZdcfyVICgp5hr0sNb23', 1],  // Moussa TOURE
    ['axR27NUZHWhuDDvdNI4AJanXMvK2', 1],  // Moussa Moussa
    ['fAHCYt8nRpTMiTVlG1rbVow05uw1', 1],  // Ethanäo (the organizer/coordinator)
    ['fKA4tAQRVRPpXAT59ig4uyMPBcZ2', 1],  // Olivier
  ];
  const totalSpots = attendeeSpec.reduce((sum, [, n]) => sum + n, 0);
  console.log(`Total attendee spots: ${totalSpots}, max_players: ${maxPlayers}`);
  if (totalSpots > maxPlayers) {
    console.error(`ERROR: ${totalSpots} spots would exceed max_players=${maxPlayers}. Aborting.`);
    process.exit(1);
  }

  // Build teams array preserving team_side allocation
  const newTeams = currentTeams.map(s => ({
    team_side: s.team_side,
    status: 'open',
    user_id: null,
    plus_one: false,
  }));
  // Assign in order
  let slotIdx = 0;
  for (const [uid, n] of attendeeSpec) {
    for (let k = 0; k < n; k++) {
      newTeams[slotIdx].status = 'confirmed';
      newTeams[slotIdx].user_id = uid;
      newTeams[slotIdx].plus_one = k > 0;
      slotIdx++;
    }
  }

  // Build attendees array — one DocumentReference per spot (a user with N spots
  // appears N times in the array, matching the app's convention)
  const newAttendees = [];
  for (const [uid, n] of attendeeSpec) {
    for (let k = 0; k < n; k++) {
      newAttendees.push(db.collection('users').doc(uid));
    }
  }

  console.log('\nNew teams:');
  for (const [i, s] of newTeams.entries()) {
    console.log(`  [${i}] ${s.team_side} ${s.status} ${s.user_id?.substring(0,10) || '-'} ${s.plus_one?'+1':''}`);
  }
  console.log(`\nNew attendees array: ${newAttendees.length} entries`);
  console.log('');

  if (!COMMIT) {
    console.log('DRY-RUN. Add --commit to apply.');
    process.exit(0);
  }

  await gameRef.update({
    teams: newTeams,
    attendees: newAttendees,
  });
  console.log('WROTE teams + attendees atomically.');

  // Wait a moment for updateTeamsAttendees to fire, then check
  await new Promise(r => setTimeout(r, 3000));
  const after = (await gameRef.get()).data();
  const afterCounts = {};
  for (const s of (after.teams||[])) afterCounts[s.status] = (afterCounts[s.status]||0)+1;
  console.log(`\nPost-trigger state: teams=${JSON.stringify(afterCounts)}, attendees.length=${(after.attendees||[]).length}`);
  process.exit(0);
})();
