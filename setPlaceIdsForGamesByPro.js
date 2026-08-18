const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function processGames() {
  try {
    const currentDate = new Date();

    const gamesSnapshot = await db.collection('games').where('date', '>', currentDate).get();

    gamesSnapshot.forEach(async (doc) => {
      const gameData = doc.data();
      const gameId = doc.id;

      console.log(`Processing game with ID: ${gameId}`);

      if (!gameData.place_id) {
        const organizerId = gameData.organizer;

        if (!organizerId) {
          console.log(`No organizer found for game ${gameId}`);
          return;
        }

        console.log(`Fetching user data for organizer ${organizerId}`);

        const userRef = db.collection('users').doc(organizerId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
          console.log(`User document with ID ${organizerId} not found`);
          return;
        }

        const userData = userDoc.data();
        const userType = userData.type;

        if (!userType || !userType.includes('pro')) {
          console.log(`User ${organizerId} is not a pro`);
          return;
        }

        const centrePlaceId = userData.centre_place_id;

        if (!centrePlaceId) {
          console.log(`No centre_place_id found for user ${organizerId}`);
          return;
        }

        console.log(`Updating game ${gameId} with place_id ${centrePlaceId}`);

        await doc.ref.update({ place_id: centrePlaceId });

        console.log(`Game ${gameId} successfully updated`);
      } else {
        console.log(`Place_id already set for game ${gameId}`);
      }
    });
  } catch (error) {
    console.error('Error processing games:', error);
  }
}

processGames();