const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateDescriptions() {
  try {
    console.log('Fetching repeaters where organizer is "JfJC0qd2OvO5Lb10A6Ia4SuKmAa2"...');
    
    const querySnapshot = await db.collection('repeaters')
      .where('organizer', '==', 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2')
      .get();
    
    console.log(`Found ${querySnapshot.size} repeaters.`);
    
    let updatesCount = 0;
    const batch = db.batch();
    
    querySnapshot.forEach((doc) => {
      batch.update(doc.ref, { 
        description: `⚽ Save on Pickup Games at Soctainer? Say Less. 🔥

Welcome on Miami’s new best soccer app: Poteau!

We just launched and we’re kicking things off at Soctainer, one of the dopest soccer spots in the city.

Pull up, play for a few bucks, and run it back: it's our treat.

📲 Lock in your spot now. You know the deal.`
      });
      updatesCount++; // Fix: Increment updates count
    });
    
    if (updatesCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updatesCount} repeater(s).`);
    } else {
      console.log('No updates needed.');
    }
  } catch (error) {
    console.error('Error updating repeaters:', error);
  }
}

updateDescriptions().then(() => {
  console.log('Script execution completed.');
  process.exit(0);
});