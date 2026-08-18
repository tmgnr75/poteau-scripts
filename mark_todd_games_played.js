const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const GAME_IDS = ['bTuLIrvXCfbilsFtxGlQ', 'qvXN9GaKH3coeAqZhHPN'];
const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';

async function main() {
  for (const gameId of GAME_IDS) {
    const gameRef = db.collection('games').doc(gameId);
    const gameDoc = await gameRef.get();

    if (!gameDoc.exists) {
      console.log(`Game ${gameId} does not exist!`);
      continue;
    }

    const data = gameDoc.data();
    console.log(`Game ${gameId}: organizer=${data.organizer}, status=${data.status}, date=${data.date?.toDate?.()}`);

    if (data.organizer !== TODD_UID) {
      console.log(`  WARNING: organizer is not Todd, skipping.`);
      continue;
    }

    if (data.status === 'played') {
      console.log(`  Already marked as played, skipping.`);
      continue;
    }

    await gameRef.update({ status: 'played' });
    console.log(`  ✓ Updated status to "played".`);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
