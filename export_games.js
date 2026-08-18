const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// Define date range
const startDate = new Date('2023-08-01T00:00:00+02:00');
const endDate = new Date('2025-03-01T00:00:00+02:00');

const now = new Date();
const timestamp = `_${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;

// CSV Writer setup
const csvWriter = createCsvWriter({
  path: `exports/games${timestamp}.csv`,
  header: [
    { id: 'docId', title: 'DOC_ID' },
    { id: 'centre', title: 'CENTRE' },
    { id: 'status', title: 'STATUS' },
    { id: 'type', title: 'TYPE' },
    { id: 'place_id', title: 'PLACE_ID' },
    { id: 'location', title: 'LOCATION' },
    { id: 'date', title: 'DATE' },
    { id: 'duration', title: 'DURATION' },
    { id: 'price', title: 'PRICE' },
    { id: 'price_undiscounted', title: 'PRICE_UNDISCOUNTED' },
    { id: 'visibility', title: 'VISIBILITY' },
    { id: 'gold_exclusive', title: 'GOLD_EXCLUSIVE' },
    { id: 'mood', title: 'MOOD' },
    { id: 'level', title: 'LEVEL' },
    { id: 'organizer', title: 'ORGANIZER' },
    { id: 'attendees', title: 'ATTENDEES' },
    { id: 'max_players', title: 'MAX_PLAYERS' },
    { id: 'good_players', title: 'GOOD_PLAYERS' },
    { id: 'late_players', title: 'LATE_PLAYERS' },
    { id: 'no_show_players', title: 'NO_SHOW_PLAYERS' },
    { id: 'rude_players', title: 'RUDE_PLAYERS' },
    { id: 'interested', title: 'INTERESTED' },
    { id: 'payment_type', title: 'PAYMENT_TYPE' }
  ],
  encoding: 'utf-8',
});

// Query Firestore with date range filter
db.collection('games')
  .where('date', '>=', admin.firestore.Timestamp.fromDate(startDate))
  .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate))
  .get()
  .then(snapshot => {
    const records = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        docId: doc.id,
        centre: data.centre || '',
        status: data.status || '',
        type: data.type || 'captain',
        place_id: data.place_id || '',
        location: data.location ? `${data.location.latitude}&${data.location.longitude}` : '',
        date: data.date ? data.date.toDate().toISOString() : '',
        duration: data.duration || 0,
        price: data.price || '',
        price_undiscounted: data.price_undiscounted || '',
        visibility: data.visibility || 'public',
        gold_exclusive: data.gold_exclusive || false,
        mood: data.mood || '',
        level: data.level || '',
        organizer: data.organizer || '',
        attendees: data.attendees ? data.attendees.length : 0,
        max_players: data.max_players || 0,
        good_players: data.good_players ? data.good_players.length : 0,
        late_players: data.late_players ? data.late_players.length : 0,
        no_show_players: data.no_show_players ? data.no_show_players.length : 0,
        rude_players: data.rude_players ? data.rude_players.length : 0,
        interested: data.interested ? data.interested.length : 0,
        payment_type: data.payment_type || 'on-site'
      };
    });

    return csvWriter.writeRecords(records);
  })
  .then(() => {
    console.log('CSV file was written successfully');
  })
  .catch(error => {
    console.error('Error writing CSV file:', error);
  });