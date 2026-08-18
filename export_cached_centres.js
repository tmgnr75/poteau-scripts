const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// Get the current date and time
const now = new Date();
const year = now.getFullYear().toString().slice(-2); // Get the last 2 digits of the year
const month = (now.getMonth() + 1).toString().padStart(2, '0'); // Get the month with leading zero if needed
const day = now.getDate().toString().padStart(2, '0'); // Get the day with leading zero if needed
const hour = now.getHours().toString().padStart(2, '0'); // Get the hour with leading zero if needed
const minute = now.getMinutes().toString().padStart(2, '0'); // Get the minute with leading zero if needed

const timestamp = `_${year}${month}${day}_${hour}${minute}`;

// CSV Writer setup with timestamp in the filename
const csvWriter = createCsvWriter({
  path: `exports/cached_centres${timestamp}.csv`,
  header: [
    { id: 'docId', title: 'DOC_ID' },
    { id: 'centre', title: 'CENTRE' },
    { id: 'place_id', title: 'PLACE_ID' }
  ]
});

// Fetch data from Firestore and write to CSV
db.collection('cached_centres').get()
  .then(snapshot => {
    const records = [];

    snapshot.forEach(doc => {
      let data = doc.data();

      records.push({
        docId: doc.id,
        centre: data.centre_name,
        place_id: data.centre_place_id
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