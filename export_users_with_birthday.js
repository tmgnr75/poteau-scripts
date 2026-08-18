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
  path: `exports/cached_users.csv`,
  header: [
    { id: 'user_id', title: 'USER_ID' },
    { id: 'name', title: 'NAME' },
    { id: 'birthday', title: 'BIRTHDAY' }
  ],
  encoding: 'utf-8', // Set encoding to 'utf-8' to handle accents properly
});

db.collection('users')
  .where('birthday', '>', new Date(0)) // Filter out null values
  .get()
  .then(snapshot => {
    const records = [];
    let count = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const birthday = data.birthday.toDate(); // Convert Firestore timestamp to JavaScript Date object
      const formattedBirthday = birthday.toLocaleDateString('en-GB'); // Format as DD-MM-YYYY

      records.push({
        user_id: doc.id,
        name: data.display_name || '',
        birthday: formattedBirthday || ''
      });

      count++;
    });

    console.log(`Found ${count} user(s) with non-null and non-empty birthday`);

    return csvWriter.writeRecords(records);
  })
  .then(() => {
    console.log('CSV file was written successfully');
  })
  .catch(error => {
    console.error('Error writing CSV file:', error);
  });
