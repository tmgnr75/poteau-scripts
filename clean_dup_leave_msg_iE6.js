const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// The two player_left_man logs for Sofiane KARAOUNI on game iE6JdUyOz4efxGoPNpkH:
//   ThvgdGk1p0iAAfpsGQOK  @ 19:37:37  (keep — first leave)
//   Zqm9ozqxfZSMRlwv3ai9  @ 19:37:44  (delete — duplicate from double-tap)
const DUP_ID = 'Zqm9ozqxfZSMRlwv3ai9';
const KEEP_ID = 'ThvgdGk1p0iAAfpsGQOK';

async function main() {
  const dup = await db.collection('messages').doc(DUP_ID).get();
  const keep = await db.collection('messages').doc(KEEP_ID).get();
  if (!dup.exists) { console.log('Dup already gone, nothing to do.'); return; }
  if (!keep.exists) { console.log('SAFETY ABORT: the keeper doc does not exist — refusing to delete.'); return; }

  const d = dup.data();
  console.log('About to delete duplicate log doc:');
  console.log('  id      :', DUP_ID);
  console.log('  trigger :', d.trigger);
  console.log('  author  :', d.author_name);
  console.log('  created :', d.created && d.created.toDate().toISOString());

  await db.collection('messages').doc(DUP_ID).delete();
  console.log('\nDeleted. Keeper doc', KEEP_ID, 'retained.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
