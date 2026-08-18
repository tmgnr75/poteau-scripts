// Seeds three test accounts as pending friend requests on Tim's account so
// the Home "pending friends" frame can be reviewed with real data.
//
// ONE-SIDED, matching the app. add_to_team_button writes only to the
// RECIPIENT's pending_friends ("Add me as their pending"); the sender's own
// doc is untouched. So to make Tim see three incoming requests, each tester
// must be added to TIM's array only -- not the reverse.
//
// Run with --undo to remove them again.
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const ME = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2';
const TESTERS = [
  '8vZmdIBOZTcqMFMQKltTcfc7ffl1', // Lucia Test
  '9si5imsCVUUQ48LF5sc9XFLFtEj1', // Noah Test
  'Go2YXYj9FFW6xG28HZNBcrDkIJV2', // Liam Test
];

(async () => {
  const undo = process.argv.includes('--undo');
  const op = undo ? admin.firestore.FieldValue.arrayRemove
                  : admin.firestore.FieldValue.arrayUnion;
  const meRef = db.collection('users').doc(ME);

  for (const uid of TESTERS) {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) { console.log('skip (missing):', uid); continue; }
    if (snap.get('is_test_account') !== true) {
      console.log('REFUSING (not a test account):', uid);
      continue;
    }
    // Only Tim's doc: he is the RECIPIENT of these requests.
    await meRef.update({ pending_friends: op(ref) });
    console.log(undo ? 'removed' : 'added', snap.get('display_name'));
  }

  const me = await meRef.get();
  console.log('my pending_friends now:', (me.get('pending_friends') || []).length);
  process.exit(0);
})();
