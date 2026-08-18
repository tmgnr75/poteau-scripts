const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// IDs of documents to delete
const documentIds = [
    '1WIRaFHwHwU5T8yX9vPb',
    '1mGrTya3lhR1fEutyrUA',
    'B2bigRiVRSBlwBGbruaA',
    'DLHtuimyzSIfoEpePPE0',
    'DOqY48LC7iWdILITX2pK',
    'HGdFLaxkwx4UMpA1NlRF',
    'HYsXOiO2Zc52xM3z2boX',
    'I4QlGDC56EIBugojJT0T',
    'KA2fj24xkswarQ777RYE',
    'M2IoLooFnwc9vY96J0XK',
    'S9YPiZE9DsNtcE92Lehz',
    'WQz29RtT2lZ0SfB9Y7Wz',
    'Z34IUe8OnPzVlf6peAEN',
    'Z7ju5lSPgWfoLWviQs2Y',
    'aGeB2hwP7R9FgLCo1oBW',
    'ayUDSYpqv9ykoCHzMZCJ',
    'cP4vJGxQZtqsoUnc9CPB',
    'eit5nO8nX3xve9yzhy6l',
    'ioKczMuiHpgGVg4VTUsd',
    'npTP7gD9ZKJZCK12uJpf',
    'o3VjZx2oz1YbDBx4PnHd',
    'rRBNYnpO7WhvBCkbsmgv',
    'reTRjJhrEkbGiXfC1YBq',
    'rgm3i23HvDzWLPYf39k5',
    'unNXUnP0JZWgk7raeLuC',
    'uqN1uEPzVtDpS21C6V7x',
    'v8gEijZKjAxXzrBecQoF',
    'wPSk3EpDMOfecYZQqQDx'
];

async function deleteDocuments() {
    for (const docId of documentIds) {
        try {
            await db.collection('games').doc(docId).delete();
            console.log(`Document ${docId} deleted successfully.`);
        } catch (error) {
            console.error(`Error deleting document ${docId}:`, error);
        }
    }
}

deleteDocuments();
