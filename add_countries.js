const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const data = JSON.parse(fs.readFileSync('./data_countries.json', 'utf8'));

data.forEach((document) => {
  const newDocument = {
    id: document.id,
    emoji: document.emoji,
    country_name: document.country_name,
    country_code: document.country_code,
    phone_prefix: document.phone_prefix
  };

  admin.firestore().collection('countries').doc(document.id.toString()).set(newDocument);
});
