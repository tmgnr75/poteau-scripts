const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const csvWriter = createCsvWriter({
    path: `exports/games_${Date.now()}.csv`, // Using timestamp to ensure unique filename
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
        { id: 'interested', title: 'INTERESTED' }
    ],
    encoding: 'utf-8',
});

const now = new Date();

db.collection('games')
    .where('type', '==', 'pro')
    .where('date', '>', now)
    .get()
    .then(snapshot => {
        const records = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            if (!data.place_id || data.place_id.trim() === '') { // Check if place_id is null or empty
                const dateValue = data.date ? data.date.toDate() : null;

                if (dateValue) {
                    records.push({
                        docId: doc.id,
                        centre: data.centre || '',
                        status: data.status || '',
                        type: data.type || 'captain',
                        place_id: data.place_id || '',
                        location: data.location ? `${data.location.latitude}&${data.location.longitude}` : '',
                        date: dateValue.toISOString(),
                        duration: data.duration || 0,
                        price: data.price || '',
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
                        interested: data.interested ? data.interested.length : 0
                    });
                }
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
