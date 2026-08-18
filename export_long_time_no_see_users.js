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
    path: `exports/users_${Date.now()}.csv`,
    header: [
        { id: 'id', title: 'ID' }
    ],
    encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

// Define the cutoff date
const cutoffDate = new Date('2024-02-15T00:00:00Z');

db.collection('users').get()
    .then(snapshot => {
        const records = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const lastActivityDate = data.last_activity_date ? data.last_activity_date.toDate() : null;

            if (lastActivityDate === null || lastActivityDate < cutoffDate) {
                records.push({ id: doc.id });
            }
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
