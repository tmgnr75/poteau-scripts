const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function removeExpectedTime() {
    const repeatersRef = db.collection('repeaters');

    try {
        const repeatersSnapshot = await repeatersRef.get();

        repeatersSnapshot.forEach((doc) => {
            // Remove the "expected_time" field from the document
            doc.ref.update({
                expected_time: admin.firestore.FieldValue.delete()
            });

            console.log(`Removed expected_time field from document ${doc.id}`);
        });

        console.log('Expected_time field removed from all documents.');
    } catch (error) {
        console.error('Error removing expected_time field:', error);
    }
}

removeExpectedTime();