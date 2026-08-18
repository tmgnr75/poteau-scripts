const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Calculate the date 10 days ago
const tenDaysAgo = new Date();
tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

// CSV Writer setup with timestamp in the filename and encoding set to 'utf-8'
const csvWriter = createCsvWriter({
    path: `exports/connect_${Date.now()}.csv`,
    header: [
        { id: 'message', title: 'MESSAGE' },
        { id: 'sender', title: 'SENDER' },
        { id: 'source', title: 'SOURCE' },
        { id: 'datetime', title: 'DATETIME' },
        { id: 'status', title: 'STATUS' },
        { id: 'picture', title: 'PICTURE' },
        { id: 'title', title: 'TITLE' },
        { id: 'destination', title: 'DESTINATION' },
        { id: 'recipient', title: 'RECIPIENT' },
        { id: 'thread', title: 'THREAD' },
        { id: 'hash_pic', title: 'HASH_PIC' },
        { id: 'game', title: 'GAME' },
        { id: 'game_invitation', title: 'GAME_INVITATION' },
        { id: 'title_en', title: 'TITLE_EN' },
        { id: 'title_es', title: 'TITLE_ES' },
        { id: 'title_it', title: 'TITLE_IT' },
        { id: 'message_en', title: 'MESSAGE_EN' },
        { id: 'message_es', title: 'MESSAGE_ES' },
        { id: 'message_it', title: 'MESSAGE_IT' }
    ],
    encoding: 'utf-8'
});

db.collection('connect')
    .where('datetime', '>=', tenDaysAgo)
    .get()
    .then(snapshot => {
        const records = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const datetime = new Date(data.datetime.toDate()).toISOString();

            const record = {
                message: data.message || '',
                sender: data.sender ? data.sender.id : '',
                source: data.source || '',
                datetime: datetime,
                status: data.status || '',
                picture: data.picture || '',
                title: data.title || '',
                destination: data.destination || '',
                recipient: Array.isArray(data.recipient) ? data.recipient.map(ref => ref.id).join(', ') : '',
                thread: data.thread || '',
                hash_pic: data.hash_pic || '',
                game: data.game ? data.game.id : '',
                game_invitation: data.game_invitation ? data.game_invitation.id : '',
                title_en: data.title_en || '',
                title_es: data.title_es || '',
                title_it: data.title_it || '',
                message_en: data.message_en || '',
                message_es: data.message_es || '',
                message_it: data.message_it || ''
            };

            records.push(record);
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