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
    path: `exports/messages_${Date.now()}.csv`,
    header: [
        { id: 'author_id', title: 'AUTHOR_ID' },
        { id: 'author_name', title: 'AUTHOR_NAME' },
        { id: 'author_picture', title: 'AUTHOR_PICTURE' },
        { id: 'created', title: 'CREATED' },
        { id: 'game_id', title: 'GAME_ID' },
        { id: 'text', title: 'TEXT' },
        { id: 'type', title: 'TYPE' },
        { id: 'text_en', title: 'TEXT_EN' },
        { id: 'text_es', title: 'TEXT_ES' },
        { id: 'text_it', title: 'TEXT_IT' }
    ],
    encoding: 'utf-8'
});

db.collection('messages')
    .where('created', '>=', tenDaysAgo)
    .get()
    .then(snapshot => {
        const records = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const created = new Date(data.created.toDate()).toISOString();

            const record = {
                author_id: data.author_id ? data.author_id.id : '',
                author_name: data.author_name || '',
                author_picture: data.author_picture || '',
                created: created,
                game_id: data.game_id ? data.game_id.id : '',
                text: data.text || '',
                type: data.type || '',
                text_en: data.text_en || '',
                text_es: data.text_es || '',
                text_it: data.text_it || ''
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