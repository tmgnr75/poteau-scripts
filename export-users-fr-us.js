const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

const csvFilePath = 'users-fr-us.csv';
const fileStream = fs.createWriteStream(csvFilePath, { flags: 'a' });

function sanitize(data) {
  if (!data) return '';
  return '"' + String(data).replace(/"/g, '""') + '"';
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  let date;
  if (timestamp.toDate) {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else {
    return '';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

async function fetchUsers(startAfter = null) {
  try {
    const pageSize = 1000;
    let query = db.collection('users')
      .where('language', '==', 'fr')
      .where('country', '==', 'United States')
      .limit(pageSize);

    if (startAfter) {
      query = query.startAfter(startAfter);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('No more documents.');
      return;
    }

    let count = 0;
    snapshot.forEach(doc => {
      const d = doc.data();
      const displayName = sanitize(d.display_name);
      const createdTime = formatDate(d.created_time);
      const lastActivityDate = formatDate(d.last_activity_date);
      const lastAddress = sanitize(d.last_address);
      const email = d.email || '';
      const phoneNumber = d.phone_number || '';

      fileStream.write(`${displayName},${createdTime},${lastActivityDate},${lastAddress},${email},${phoneNumber}\n`);
      count++;
    });

    console.log(`Processed ${count} users in this batch.`);

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    if (snapshot.size === pageSize) {
      console.log(`Fetching next batch after ${lastDoc.id}...`);
      await fetchUsers(lastDoc);
    } else {
      console.log('All users processed. Export completed.');
      fileStream.end();
    }
  } catch (error) {
    console.error('Error fetching users from Firestore:', error);
    fileStream.end();
  }
}

console.log('Starting export of users where language=fr and country=United States...');
fetchUsers().then(() => {
  console.log('Export script finished.');
}).catch((error) => {
  console.error('Unexpected error during export:', error.message);
  fileStream.end();
});
