const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')) });
const db = admin.firestore();
(async () => {
  const gid = '4I8EaXyDJoh2at4bi83O';
  const doc = await db.collection('games').doc(gid).get();
  if (!doc.exists) { console.log('NOT FOUND'); process.exit(0); }
  const g = doc.data();
  const repeaterRef = g.repeater;
  if (!repeaterRef) { console.log('Not a repeater game'); process.exit(0); }
  console.log('Repeater ID:', repeaterRef.id);
  console.log('');

  // Find all games from this repeater
  const snap = await db.collection('games').where('repeater', '==', repeaterRef).orderBy('date', 'asc').get();
  console.log(`Total games from this repeater: ${snap.size}\n`);
  for (const d of snap.docs) {
    const gd = d.data();
    const dt = gd.date?.toDate?.();
    console.log(`  ${d.id} | ${dt?.toLocaleString('fr-FR',{timeZone:'Europe/Paris'})} Paris | status=${gd.status} | attendees=${(gd.attendees||[]).length}/${gd.max_players}`);
  }
  process.exit(0);
})();
