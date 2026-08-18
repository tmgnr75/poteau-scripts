const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function processRepeaters() {
  try {
    const repeatersSnapshot = await db.collection('repeaters').get();

    repeatersSnapshot.forEach(async (doc) => {
      const repeaterData = doc.data();
      const repeaterId = doc.id;

      console.log(`Processing repeater with ID: ${repeaterId}`);

      if (!repeaterData.placeId) {
        const organizerId = repeaterData.organizer;

        if (!organizerId) {
          console.log(`No organizer found for repeater ${repeaterId}`);
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
        const centrePlaceId = userData.centre_place_id;

        if (!centrePlaceId) {
          console.log(`No centre_place_id found for user ${organizerId}`);
          return;
        }

        console.log(`Updating repeater ${repeaterId} with placeId ${centrePlaceId}`);

        await doc.ref.update({ placeId: centrePlaceId });

        console.log(`Repeater ${repeaterId} successfully updated`);
      } else {
        console.log(`PlaceId already set for repeater ${repeaterId}`);
      }
    });
  } catch (error) {
    console.error('Error processing repeaters:', error);
  }
}

processRepeaters();
