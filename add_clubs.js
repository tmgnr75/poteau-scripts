const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const data = JSON.parse(fs.readFileSync('./data_clubs_v2.json', 'utf8'));

data.forEach((document) => {
  const newDocument = {
    name: document.name,
    league: document.league,
    logo: document.logo
  };

  admin.firestore().collection('clubs').add(newDocument);
});
