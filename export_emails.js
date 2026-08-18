// Import necessary modules
const jsonfile = require('jsonfile');
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function exportClubs() {
    const clubsRef = db.collection('clubs');
    const snapshot = await clubsRef.get();
    
    if (snapshot.empty) {
        console.log('No matching documents.');
        return;
    }
    
    const clubs = [];

    snapshot.forEach(doc => {
        clubs.push({
            id: doc.id,
            league: doc.data().league
        });
    });

    const filePath = './clubs.json';
    jsonfile.writeFile(filePath, clubs, { spaces: 2 }, err => {
        if (err) console.error(err);
        else console.log('Data successfully written to', filePath);
    });
}

exportClubs();