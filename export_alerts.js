const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// CSV Writer setup with timestamp in the filename and encoding set to 'utf-8'
const csvWriter = createCsvWriter({
    path: `exports/alerts_${Date.now()}.csv`,
    header: [
        { id: 'created', title: 'CREATED' },
        { id: 'places', title: 'PLACES' },
        { id: 'times', title: 'TIMES' },
        { id: 'user', title: 'USER' },
        { id: 'weekdays', title: 'WEEKDAYS' }
    ],
    encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

db.collection('alerts').get()
    .then(snapshot => {
        const records = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const createdDate = new Date(data.created.toDate());
            const created = `${createdDate.getFullYear()}-${(createdDate.getMonth() + 1).toString().padStart(2, '0')}-${createdDate.getDate().toString().padStart(2, '0')}`;
            const places = data.places.map(place => `${place.centre}-${place.placeId}`).join(' ');
            const times = data.times.map(time => `_${time}_`).join(' ');
            const user = doc.id;
            const weekdays = data.weekdays.join(' ');

            records.push({ created, places, times, user, weekdays });
        });

        return csvWriter.writeRecords(records);
    })
    .then(() => {
        console.log('CSV file was written successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Error writing CSV file:', error);
        process.exit(1);
    });
