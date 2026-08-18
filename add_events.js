const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});


const data = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

data.forEach((document) => {
  const date = new Date(document.date);
  const timestamp = admin.firestore.Timestamp.fromDate(date);

  const [latitude, longitude] = document.location.split(',').map((coordinate) => parseFloat(coordinate));
  const geoPoint = new admin.firestore.GeoPoint(latitude, longitude);

  const attendees = document.attendees.map((attendee) => {
    const attendeeRef = admin.firestore().collection('users').doc(attendee);
    return attendeeRef;
  });

  const newDocument = {
    ...document,
    date: timestamp,
    location: geoPoint,
    attendees
  };

  admin.firestore().collection('games').add(newDocument);
});
