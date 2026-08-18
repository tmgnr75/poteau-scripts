const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// CSV Writer setup
const csvWriter = createCsvWriter({
  path: `exports/cached_centres.csv`,
  header: [
    { id: 'centre_name', title: 'CENTRE_NAME' },
    { id: 'centre_place_id', title: 'CENTRE_PLACE_ID' },
    { id: 'centre_location', title: 'CENTRE_LOCATION' }
  ],
  encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

db.collection('cached_centres').get()
  .then(snapshot => {
    const records = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      records.push({
        centre_name: data.centre_name || '',
        centre_place_id: data.centre_place_id || '',
        centre_location: data.centre_location || ''
      });
    });

    return csvWriter.writeRecords(records);
  })
  .then(() => {
    console.log('CSV file was written successfully');
  })
  .catch(error => {
    console.error('Error writing CSV file:', error);
  });
