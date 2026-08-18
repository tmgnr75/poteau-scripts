const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

admin.auth().createCustomToken('1RJFDFRGwfeFnRE5RitMZDBW0Ao1')
  .then((customToken) => {
    console.log('Custom Token:', customToken);
  })
  .catch((error) => {
    console.error('Error creating custom token:', error);
  });