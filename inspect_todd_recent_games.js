const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();
const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';

async function main() {
  // Pull recent games organized by Todd, all statuses.
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .orderBy('date', 'desc')
    .limit(8)
    .get();

  if (snap.empty) {
    console.log('No games found for Todd.');
    return;
  }

  console.log(`Found ${snap.size} recent games for Todd. Showing latest 3 in full:\n`);

  let idx = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate?.() ?? d.date;
    console.log(
      `[${idx + 1}] ${doc.id} | status=${d.status} | sport=${d.sport} | date=${date} | centre="${d.centre}" | placeId=${d.place_id}`
    );
    if (idx < 3) {
      // Print every field, expanding refs to paths.
      const printable = {};
      for (const [k, v] of Object.entries(d)) {
        if (v && typeof v === 'object' && v.path) {
          printable[k] = `<DocRef ${v.path}>`;
        } else if (Array.isArray(v) && v.length && v[0] && v[0].path) {
          printable[k] = v.map((r) => `<DocRef ${r.path}>`);
        } else if (v && v.toDate) {
          printable[k] = `<Timestamp ${v.toDate().toISOString()}>`;
        } else if (v && typeof v === 'object' && '_latitude' in v) {
          printable[k] = `<GeoPoint ${v._latitude},${v._longitude}>`;
        } else {
          printable[k] = v;
        }
      }
      console.log(JSON.stringify(printable, null, 2));
      console.log('');
    }
    idx++;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
