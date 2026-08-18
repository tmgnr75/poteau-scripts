const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const documentIdsToDelete = [
    "ChIJ-S82HdRbwokRHcC6tN0__L4",
    "ChIJ1aOw95RfwokRe0fEYMdtNJg",
    "o7QMZlfjp2q5BKU7NNeR",
    "VANunFiJyTzjYXLBFmjU",
    "ChIJYVUE_J9bwokRuEBZfRYfobU",
    "qxN613Ykwp1yHj1cDRPY",
    "RNjroJetyWSvOvVcQ1Id",
    "ldQ3INQIR2qmr3h8YQIj",
    "fGl8GFDOob4TPgyGUf9Y"
];

async function deleteCentreDocumentsById(docIds) {
    const batch = db.batch();

    for (const docId of docIds) {
        try {
            const docRef = db.collection('cached_centres').doc(docId);
            batch.delete(docRef);
            console.log(`Queued deletion for document with ID: ${docId}`);
        } catch (error) {
            console.error(`Error queuing deletion for document ID ${docId}:`, error);
        }
    }

    try {
        await batch.commit();
        console.log('Batch deletion completed successfully.');
    } catch (error) {
        console.error('Error during batch deletion:', error);
    }
}

deleteCentreDocumentsById(documentIdsToDelete).then(() => {
    console.log('Deletion process finished.');
}).catch(error => {
    console.error('An error occurred during the deletion process:', error);
});