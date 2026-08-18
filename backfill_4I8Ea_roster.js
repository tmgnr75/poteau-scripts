// Backfill teams + attendees on the 2 upcoming published occurrences of
// repeater DgC6nYuDOdUVwW39L9Kp from the initial game 4I8EaXyDJoh2at4bi83O.
// Uses the same "clear-then-set" flow that fixed CxxjBEed to avoid fighting
// updateTeamsAttendees.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

const INITIAL_GAME_ID = '4I8EaXyDJoh2at4bi83O';
const TARGETS = ['iB2rg17woLmR5x4s7aEd', 'nlfyvEO6RBMbN9g5Oc3Z'];
const COMMIT = process.argv.includes('--commit');

(async () => {
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  const initial = (await db.collection('games').doc(INITIAL_GAME_ID).get()).data();
  const teams = initial.teams || [];
  const attendees = initial.attendees || [];
  console.log(`Source game ${INITIAL_GAME_ID}: ${(attendees||[]).length} attendees, ${(teams||[]).length} team spots`);

  for (const id of TARGETS) {
    const ref = db.collection('games').doc(id);
    const doc = await ref.get();
    if (!doc.exists) { console.log(`  ${id}: NOT FOUND`); continue; }
    const g = doc.data();
    console.log(`\n  ${id} | date=${g.date?.toDate?.().toISOString()} | current: attendees=${(g.attendees||[]).length} teams=${(g.teams||[]).length}`);
    if ((g.attendees||[]).length > 0) {
      console.log(`    ⚠️  already has attendees — skipping for safety`);
      continue;
    }
    if (!COMMIT) {
      console.log(`    [dry-run] would set teams=${teams.length} + attendees=${attendees.length}`);
      continue;
    }
    // Clear attendees first → CASE 1 in trigger → resets teams to all-open
    await ref.update({ attendees: [] });
    await new Promise(r => setTimeout(r, 3000));
    // Now set attendees → CASE 3 → surgical placement (no lockedUsers now)
    await ref.update({ attendees });
    await new Promise(r => setTimeout(r, 3000));
    const after = (await ref.get()).data();
    const c = (after.teams||[]).reduce((m, s) => (m[s.status]=(m[s.status]||0)+1, m), {});
    console.log(`    ✓ done | attendees=${(after.attendees||[]).length} | teams=${JSON.stringify(c)}`);
  }
  process.exit(0);
})();
