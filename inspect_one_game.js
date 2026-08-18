const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();
const GAME_ID = process.argv[2];
if (!GAME_ID) {
  console.error('Usage: node inspect_one_game.js <gameId>');
  process.exit(1);
}

async function main() {
  const doc = await db.collection('games').doc(GAME_ID).get();
  if (!doc.exists) {
    console.log('Game not found.');
    return;
  }
  const d = doc.data();
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
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
