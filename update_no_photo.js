const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function fetchDocuments() {
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        console.log(`Fetched ${snapshot.size} users.`);

        const documents = snapshot.docs.filter(doc => {
            const photoUrl = doc.data().photo_url;
            return photoUrl === null || photoUrl === '' || photoUrl === undefined;
        });
        console.log(`Found ${documents.length} users with null, empty, or missing photo_url.`);

        console.log('Here are the IDs of the first 20 documents:');
        documents.slice(0, 20).forEach(doc => {
            console.log(doc.id);
        });
        console.log('');

        return documents.length > 0 ? documents : null;
    } catch (error) {
        console.error('Error fetching documents:', error);
        return null;
    }
}


async function shouldProceed(documents) {
    if (!documents) {
        console.error('No documents fetched.');
        return false;
    }

    return new Promise((resolve, reject) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });

        readline.question('Do you want to proceed? (Y/N): ', answer => {
            readline.close();
            if (answer.toUpperCase() === 'Y') {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}


async function updateDocuments() {
    const snapshot = await fetchDocuments();
    if (!snapshot) return;

    const proceed = await shouldProceed(snapshot);
    if (!proceed) {
        console.log('Operation cancelled.');
        return;
    }

    try {
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { photo_url: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fben-poteau-small.png?alt=media&token=7bcdd130-a529-4d37-8e67-75048fd07a0e' });
        });

        await batch.commit();
        console.log('Documents updated successfully.');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

updateDocuments();
