const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const fs = require('fs');

// Reference the 'selections' collection
const selectionsCollection = db.collection('selections');

// Function to export data
async function exportSelections() {
  try {
    // Get all documents from the 'selections' collection
    const snapshot = await selectionsCollection.get();

    // Create an array to store the results
    const selectionsData = [];

    // Loop through each document
    snapshot.forEach(doc => {
      const data = doc.data();
      selectionsData.push({
        id: doc.id,        // Document ID
        name_fr: data.name_fr  // French name
      });
    });

    // Convert the array to JSON
    const jsonData = JSON.stringify(selectionsData, null, 2);

    // Write the data to a file
    fs.writeFileSync('selections_export.json', jsonData);

    console.log('Export completed successfully.');
  } catch (error) {
    console.error('Error exporting selections:', error);
  }
}

// Run the export function
exportSelections();