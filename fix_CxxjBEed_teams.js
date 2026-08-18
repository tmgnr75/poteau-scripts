// One-off repair: rebuild games/CxxjBEed2OTKFTNN0WBX teams array from the
// captured payments. Users showed the game as 4/10 in the UI despite 10 people
// paid and coordinated — the teams array had all 10 spots as 'open' while
// attendees + payments were intact.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

const GAME_ID = 'CxxjBEed2OTKFTNN0WBX';
const DRY_RUN = !process.argv.includes('--commit');

(async () => {
  const gameRef = db.collection('games').doc(GAME_ID);
  const gameDoc = await gameRef.get();
  const game = gameDoc.data();

  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'COMMIT'}`);
  console.log('');

  // Build the definitive user → paid-spots-count map from captured payments
  const paysSnap = await db.collection('payments')
    .where('game_ref', '==', gameRef)
    .where('status', '==', 'captured')
    .get();

  const paidUserSpots = new Map(); // uid → number of spots they paid for
  for (const p of paysSnap.docs) {
    const pd = p.data();
    const uid = pd.user_ref?.id;
    if (!uid) continue;
    const spots = pd.spots || 1;
    paidUserSpots.set(uid, (paidUserSpots.get(uid) || 0) + spots);
  }

  // Manual override for Ayoub: he has 4 captured spots due to a rapid-fire
  // duplicate-payment race (3 captures in 61 seconds). His intent was to
  // reserve himself + 2 friends = 3 spots. The 4th capture is a real
  // overcharge that will be manually refunded on Stripe. Cap to 3 here so
  // the teams array reflects true attendee count.
  if (paidUserSpots.get('96jHhwxo8FewE0AOzSM7ePMXVaH2') === 4) {
    paidUserSpots.set('96jHhwxo8FewE0AOzSM7ePMXVaH2', 3);
    console.log('MANUAL OVERRIDE: Ayoub capped at 3 spots (was 4 due to duplicate captures)');
  }
  console.log('Captured payments by user:');
  for (const [uid, n] of paidUserSpots.entries()) console.log(`  ${uid}: ${n} spot(s)`);
  const totalPaidSpots = [...paidUserSpots.values()].reduce((a, b) => a + b, 0);
  console.log(`Total paid spots: ${totalPaidSpots}`);
  console.log('');

  // Preserve team_side assignments from current teams array so we don't
  // scramble the team_a/team_b balance
  const currentTeams = game.teams || [];
  console.log(`Current teams array (${currentTeams.length}):`);
  for (const [i, s] of currentTeams.entries()) {
    console.log(`  [${i}] side=${s.team_side} status=${s.status} user_id=${s.user_id || '-'}`);
  }
  console.log('');

  // Build the new teams array: assign paid users into open slots preserving
  // team_side. For a user with N paid spots, first slot = them, N-1 subsequent
  // slots = plus_one for the same user.
  const newTeams = currentTeams.map(s => ({ ...s })); // shallow copies
  // Reset all statuses first (in case some are lingering reserved/confirmed)
  for (const s of newTeams) {
    s.status = 'open';
    s.user_id = null;
    s.plus_one = false;
  }

  // Assign paid users into slots
  let slotIdx = 0;
  for (const [uid, n] of paidUserSpots.entries()) {
    for (let k = 0; k < n; k++) {
      if (slotIdx >= newTeams.length) {
        console.warn(`  ⚠️  Not enough slots! ${uid} spot ${k+1}/${n} would overflow`);
        break;
      }
      newTeams[slotIdx].status = 'confirmed';
      newTeams[slotIdx].user_id = uid;
      newTeams[slotIdx].plus_one = k > 0;
      slotIdx++;
    }
  }

  console.log(`New teams array (${newTeams.length}):`);
  const statusCounts = {};
  for (const [i, s] of newTeams.entries()) {
    console.log(`  [${i}] side=${s.team_side} status=${s.status} user_id=${s.user_id || '-'}${s.plus_one ? ' (+1)' : ''}`);
    statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
  }
  console.log(`status counts: ${JSON.stringify(statusCounts)}`);
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY-RUN] no writes. Add --commit to apply.');
    process.exit(0);
  }

  await gameRef.update({ teams: newTeams });
  console.log('[COMMIT] teams array updated on the game doc.');
  process.exit(0);
})();
