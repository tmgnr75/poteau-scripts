const admin = require('firebase-admin');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Initialize Firebase Admin SDK
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

// Define the CSV writer
const csvWriter = createCsvWriter({
  path: 'exports/logs.csv',
  header: [
    { id: 'author_id', title: 'author_id' },
    { id: 'author_name', title: 'author_name' },
    { id: 'created', title: 'created' },
    { id: 'game_id', title: 'game_id' },
    { id: 'text', title: 'text' },
    { id: 'type', title: 'type' }
  ]
});

// Define the date threshold
const dateThreshold = new Date('2024-05-21T00:00:00Z');

async function exportLogs() {
  try {
    const snapshot = await db.collection('messages')
      .where('type', '==', 'log')
      .where('created', '>', dateThreshold)
      .get();

    if (snapshot.empty) {
      console.log('No matching documents.');
      return;
    }

    const records = [];

    snapshot.forEach(doc => {
      const data = doc.data();

      records.push({
        author_id: data.author_id.id,
        author_name: data.author_name,
        created: data.created.toDate().toISOString(),
        game_id: data.game_id.id,
        text: data.text,
        type: data.type
      });
    });

    // Write to CSV
    await csvWriter.writeRecords(records);
    console.log('CSV file was written successfully');

  } catch (error) {
    console.error('Error exporting logs:', error);
  }
}

// Run the export function
exportLogs();