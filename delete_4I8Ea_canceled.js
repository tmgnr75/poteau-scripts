// Delete the 3 canceled future occurrences of Tim's ambassador-repeater
// test game 4I8EaXyDJoh2at4bi83O (repeater DgC6nYuDOdUVwW39L9Kp).
// Created by the pre-fix createGamesFromRepeater which produced 6 games;
// the new cap is 3 total.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const IDS = ['TsBrr0n9nPWiEKfBNYks', 'R2vDLU621Z9Q0Qs5sgzM', 'Q56iUZsDi0hV1ChjSs60'];

(async () => {
  console.log(`Mode: ${COMMIT ? 'COMMIT' : 'DRY-RUN'}`);
  for (const id of IDS) {
    const ref = db.collection('games').doc(id);
    const doc = await ref.get();
    if (!doc.exists) { console.log(`  ${id}: not found`); continue; }
    const g = doc.data();
    console.log(`  ${id} | status=${g.status} | attendees=${(g.attendees||[]).length} | date=${g.date?.toDate?.().toISOString()}`);
    if (g.status !== 'canceled') {
      console.log(`    ⚠️  NOT canceled — skipping for safety`);
      continue;
    }
    if ((g.attendees||[]).length > 0) {
      console.log(`    ⚠️  has attendees — skipping for safety`);
      continue;
    }
    if (COMMIT) {
      await ref.delete();
      console.log(`    ✓ deleted`);
    } else {
      console.log(`    [dry-run] would delete`);
    }
  }
  process.exit(0);
})();
