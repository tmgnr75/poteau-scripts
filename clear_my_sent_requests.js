// Removes Tim's ref from every user's pending_friends -- i.e. withdraws all
// friend requests he has sent. Used after rate-limit testing sent requests
// to real accounts by accident.
//
// Safe to re-run: arrayRemove on a value that isn't there is a no-op.
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const ME = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2';

(async () => {
  const meRef = db.collection('users').doc(ME);
  const snap = await db.collection('users')
    .where('pending_friends', 'array-contains', meRef).get();

  console.log('withdrawing from', snap.docs.length, 'users');
  let real = 0, test = 0;
  for (const d of snap.docs) {
    await d.ref.update({
      pending_friends: admin.firestore.FieldValue.arrayRemove(meRef),
    });
    if (d.get('is_test_account') === true) test++; else real++;
    console.log('  cleared:', d.get('display_name'));
  }
  console.log(`\ndone -- ${real} real accounts, ${test} test accounts`);

  const after = await db.collection('users')
    .where('pending_friends', 'array-contains', meRef).get();
  console.log('remaining:', after.docs.length);
  process.exit(0);
})();
