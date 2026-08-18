const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// Function to filter records by date within a given range
function isDateWithinRange(date) {
  const startDate = new Date('2023-08-01T00:00:00+02:00');
  const endDate = new Date('2024-03-31T23:59:59+01:00');
  return date >= startDate && date <= endDate;
}

const now = new Date();
const year = now.getFullYear().toString().slice(-2);
const month = (now.getMonth() + 1).toString().padStart(2, '0');
const day = now.getDate().toString().padStart(2, '0');
const hour = now.getHours().toString().padStart(2, '0');
const minute = now.getMinutes().toString().padStart(2, '0');
const timestamp = `_${year}${month}${day}_${hour}${minute}`;

// CSV Writer setup with timestamp in the filename and encoding set to 'utf-8'
const csvWriter = createCsvWriter({
  path: `exports/centres_from_games${timestamp}.csv`,
  header: [
    { id: 'docId', title: 'DOC_ID' },
    { id: 'centre', title: 'CENTRE' },
    { id: 'status', title: 'STATUS' },
    { id: 'type', title: 'TYPE' },
    { id: 'place_id', title: 'PLACE_ID' },
    { id: 'location', title: 'LOCATION' },
    { id: 'date', title: 'DATE' }
  ],
  encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

db.collection('games').get()
  .then(snapshot => {
    const records = [];

    snapshot.forEach(async doc => {
      const data = doc.data();
      const dateValue = data.date ? data.date.toDate() : null;

      if (isDateWithinRange(dateValue)) {
        records.push({
          docId: doc.id,
          centre: data.centre || '',
          status: data.status || '',
          type: data.type || 'captain',
          place_id: data.place_id || '',
          location: data.location ? `${data.location.latitude}&${data.location.longitude}` : '',
          date: dateValue ? dateValue.toISOString() : ''
        });
      }
    });

    return csvWriter.writeRecords(records);
  })
  .then(() => {
    console.log('CSV file was written successfully');
  })
  .catch(error => {
    console.error('Error writing CSV file:', error);
  });