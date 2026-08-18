const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function populateExpectedTime() {
    const repeatersRef = db.collection('repeaters');

    try {
        const repeatersSnapshot = await repeatersRef.get();

        repeatersSnapshot.forEach((doc) => {
            const repeaterData = doc.data();

            if (repeaterData.time) {
                // Get the time in UTC+8 (original timezone)
                const timeUtcPlus8 = repeaterData.time.toDate();
                const timeUtcPlus2 = new Date(timeUtcPlus8);
                timeUtcPlus2.setHours(timeUtcPlus2.getHours());

                // Format the time in 24-hour format, ensuring midnight is "00:00"
                const formattedTime = timeUtcPlus2.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                // Update the document with the expected_time field
                doc.ref.update({
                    expectedTime: formattedTime
                });

                console.log(`Updated expectedTime for document ${doc.id}: ${formattedTime}`);
            }
        });

        console.log('All documents updated.');
    } catch (error) {
        console.error('Error updating documents:', error);
    }
}

populateExpectedTime();