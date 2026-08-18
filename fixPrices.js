const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function fixPrices(collection, query) {
  try {
    console.log(`Fetching documents from ${collection} where organizer is "JfJC0qd2OvO5Lb10A6Ia4SuKmAa2"...`);
    
    const querySnapshot = await query.get();
    
    console.log(`Found ${querySnapshot.size} documents in ${collection}.`);
    
    let updatesCount = 0;
    const batch = db.batch();
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const priceField = collection === 'games' ? 'price' : 'price';
      const priceUndiscountedField = collection === 'games' ? 'price_undiscounted' : 'priceUndiscounted';
      const price = data[priceField];
      const priceUndiscounted = data[priceUndiscountedField];
      
      if (typeof price === 'number' && typeof priceUndiscounted === 'number') {
        if (priceUndiscounted < price) {
          console.log(`Swapping values for doc ID: ${doc.id} in ${collection}`);
          console.log(`  - Previous: ${priceField} = ${price}, ${priceUndiscountedField} = ${priceUndiscounted}`);
          
          batch.update(doc.ref, {
            [priceField]: priceUndiscounted,
            [priceUndiscountedField]: price,
          });
          
          updatesCount++;
        } else {
          console.log(`Skipping doc ID: ${doc.id} (values are correct) in ${collection}`);
        }
      } else {
        console.warn(`Skipping doc ID: ${doc.id} (invalid types for price fields) in ${collection}`);
      }
    });
    
    if (updatesCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updatesCount} document(s) in ${collection}.`);
    } else {
      console.log(`No updates needed in ${collection}.`);
    }
  } catch (error) {
    console.error(`Error updating ${collection}:`, error);
  }
}

async function runFix() {
  const now = new Date();
  
  await fixPrices('repeaters', db.collection('repeaters')
    .where('organizer', '==', 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2'));
  
  await fixPrices('games', db.collection('games')
    .where('organizer', '==', 'JfJC0qd2OvO5Lb10A6Ia4SuKmAa2')
    .where('date', '>', now));
}

runFix().then(() => {
  console.log('Script execution completed.');
  process.exit(0);
});
