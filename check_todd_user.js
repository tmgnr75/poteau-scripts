const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();
const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';

async function main() {
  const doc = await db.collection('users').doc(TODD_UID).get();
  const d = doc.data();
  const printable = {
    display_name: d.display_name,
    email: d.email,
    type: d.type,
    sports: d.sports,
    last_address: d.last_address,
    soccer_position: d.soccer_position,
    upcoming_games_count: (d.upcoming_games || []).length,
    upcoming_games_sample: (d.upcoming_games || []).slice(0, 3).map((r) => r.path || r),
    games_count: (d.games || []).length,
    country: d.country,
    country_code: d.country_code,
    time_zone: d.time_zone,
    nickname: d.nickname,
    name_choice: d.name_choice,
  };
  console.log(JSON.stringify(printable, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
