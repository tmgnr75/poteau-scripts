const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const data = JSON.parse(fs.readFileSync('./data_selections.json', 'utf8'));

data.forEach((document) => {
  const newDocument = {
    name_en: document.name_en,
    name_fr: document.name_fr,
    country_code: document.country_code
  };

  admin.firestore().collection('selections').add(newDocument);
});
