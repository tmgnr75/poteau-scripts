const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// CSV Writer setup
const csvWriter = createCsvWriter({
  path: 'games.csv',
  header: [
    { id: 'docId', title: 'DOC_ID' },
    { id: 'centre', title: 'CENTRE' },
    { id: 'status', title: 'STATUS' },
    { id: 'date', title: 'DATE' }
  ]
});

// Fetch data from Firestore and write to CSV
db.collection('games').get()
  .then(snapshot => {
    const records = [];

    snapshot.forEach(doc => {
      let data = doc.data();
      records.push({
        docId: doc.id,
        centre: data.centre,
        status: data.status,
        date: data.date.toDate().toISOString() // Assuming 'date' is a Firestore Timestamp
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