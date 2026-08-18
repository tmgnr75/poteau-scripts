const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updatePaymentTypeForRepeaters() {
  try {
    console.log('Starting script to update paymentType for specific repeaters...');

    // Define the filter criteria
    const centreName = 'LE FIVE Paris 18';
    const weekdays = [1, 2, 3, 4, 5];
    const expectedTimes = ["11:00", "14:00", "17:00"];

    console.log(`Criteria - Centre: ${centreName}, Weekdays: ${weekdays}, Expected Times: ${expectedTimes}`);

    // Get all documents matching the criteria
    const repeatersRef = db.collection('repeaters');
    const querySnapshot = await repeatersRef
      .where('centre', '==', centreName)
      .where('weekday', 'in', weekdays)
      .where('expectedTime', 'in', expectedTimes)
      .get();

    console.log(`Found ${querySnapshot.size} documents matching the criteria.`);

    // Iterate through each document and update the paymentType
    let updatedCount = 0;
    for (const doc of querySnapshot.docs) {
      const docData = doc.data();
      console.log(`Updating document ID: ${doc.id} with current data:`, docData);

      await doc.ref.update({ paymentType: 'in-app' });

      console.log(`Updated paymentType to 'in-app' for document ID: ${doc.id}`);
      updatedCount++;
    }

    console.log(`Script completed successfully. Total documents updated: ${updatedCount}`);

  } catch (error) {
    console.error('Error during script execution:', error);
  }
}

// Execute the function
updatePaymentTypeForRepeaters();