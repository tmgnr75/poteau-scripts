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
    path: `exports/repeaters.csv`,
    header: [
        { id: 'repeaterId', title: 'REPEATER_ID' },
        { id: 'address', title: 'ADDRESS' },
        { id: 'centre', title: 'CENTRE' },
        { id: 'duration', title: 'DURATION' },
        { id: 'expectedTime', title: 'EXPECTED_TIME' },
        { id: 'firstOccurrence', title: 'FIRST_OCCURRENCE' },
        { id: 'locationLatitude', title: 'LOCATION_LATITUDE' },
        { id: 'locationLongitude', title: 'LOCATION_LONGITUDE' },
        { id: 'maxPlayers', title: 'MAX_PLAYERS' },
        { id: 'organizer', title: 'ORGANIZER' },
        { id: 'placeId', title: 'PLACE_ID' },
        { id: 'price', title: 'PRICE' },
        { id: 'status', title: 'STATUS' },
        { id: 'time', title: 'TIME' },
        { id: 'timeZone', title: 'TIME_ZONE' },
        { id: 'weekday', title: 'WEEKDAY' }
    ],
    encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

db.collection('repeaters')
    .get()
    .then(snapshot => {
        const records = [];
        let count = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

            // Convert timestamp fields to string in ISO format
            const firstOccurrence = data.firstOccurrence ? data.firstOccurrence.toDate().toISOString() : '';
            const time = data.time ? data.time.toDate().toISOString() : '';

            // Convert geopoint to latitude and longitude
            const locationLatitude = data.location ? data.location.latitude : '';
            const locationLongitude = data.location ? data.location.longitude : '';

            records.push({
                repeaterId: doc.id,
                address: data.address || '',
                centre: data.centre || '',
                duration: data.duration || '',
                expectedTime: data.expectedTime || '',
                firstOccurrence: firstOccurrence,
                locationLatitude: locationLatitude,
                locationLongitude: locationLongitude,
                maxPlayers: data.maxPlayers || '',
                organizer: data.organizer || '',
                placeId: data.placeId || '',
                price: data.price || '',
                status: data.status || '',
                time: time,
                timeZone: data.timeZone || '',
                weekday: data.weekday || ''
            });

            count++;
        });

        console.log(`Found ${count} repeater(s)`);

        return csvWriter.writeRecords(records);
    })
    .then(() => {
        console.log('CSV file was written successfully');
    })
    .catch(error => {
        console.error('Error writing CSV file:', error);
    });
