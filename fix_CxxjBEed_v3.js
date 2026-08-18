// Try Tim's suggestion: clear attendees first, let the trigger reset teams,
// then write attendees back. See what shakes out.

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();

(async () => {
  const gameRef = db.collection('games').doc('CxxjBEed2OTKFTNN0WBX');

  console.log('Step 1: clearing attendees...');
  await gameRef.update({ attendees: [] });
  console.log('  waiting 4s for trigger...');
  await new Promise(r => setTimeout(r, 4000));

  const afterClear = (await gameRef.get()).data();
  console.log('  after clear: attendees=' + (afterClear.attendees||[]).length + ' teams=' +
    JSON.stringify((afterClear.teams||[]).reduce((m, s) => (m[s.status]=(m[s.status]||0)+1, m), {})));

  console.log('\nStep 2: writing correct attendees...');
  const spec = [
    ['96jHhwxo8FewE0AOzSM7ePMXVaH2', 3],  // Ayoub + 2
    ['OnHsxh7dZHPr2OKwjjC2Y5wf0qH3', 1],  // VOLCANO
    ['3KxNC86KWwWHKddcrM6duGaJATi2', 1],  // alex
    ['6yal1GzoRyZFap1iy0BoWn6hpfk2', 1],  // Marlon
    ['QAogqEt4YZdcfyVICgp5hr0sNb23', 1],  // Moussa TOURE
    ['axR27NUZHWhuDDvdNI4AJanXMvK2', 1],  // Moussa Moussa
    ['fAHCYt8nRpTMiTVlG1rbVow05uw1', 1],  // Ethanäo
    ['fKA4tAQRVRPpXAT59ig4uyMPBcZ2', 1],  // Olivier
  ];
  const newAttendees = [];
  for (const [uid, n] of spec) for (let i = 0; i < n; i++) newAttendees.push(db.collection('users').doc(uid));
  await gameRef.update({ attendees: newAttendees });
  console.log('  waiting 4s for trigger...');
  await new Promise(r => setTimeout(r, 4000));

  const final = (await gameRef.get()).data();
  console.log('\nFinal state:');
  console.log('  attendees:', (final.attendees||[]).length);
  console.log('  teams:');
  for (const [i, s] of (final.teams||[]).entries()) {
    console.log(`    [${i}] ${s.status} ${s.user_id?.substring(0,10) || '-'} ${s.plus_one?'+1':''} ${s.team_side}`);
  }
  process.exit(0);
})();
