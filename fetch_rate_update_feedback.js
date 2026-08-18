const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Query for rate_update_493 feedback
const APP_VERSION = '493';

db.collection('connect')
    .where('source', '==', `rate_update_${APP_VERSION}`)
    .get()
    .then(snapshot => {
        console.log(`\n========================================`);
        console.log(`FEEDBACK REPORT FOR APP UPDATE ${APP_VERSION}`);
        console.log(`========================================\n`);
        console.log(`Total feedback entries: ${snapshot.size}\n`);

        if (snapshot.empty) {
            console.log('No feedback found for this update.');
            process.exit(0);
        }

        const feedbackList = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const datetime = data.datetime ? new Date(data.datetime.toDate()).toISOString() : 'N/A';

            feedbackList.push({
                datetime,
                message: data.message || 'No message',
                sender: data.sender ? data.sender.id : 'Unknown',
                thread: data.thread || 'N/A'
            });
        });

        // Sort by datetime (newest first)
        feedbackList.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

        feedbackList.forEach((feedback, index) => {
            console.log(`--- Feedback #${index + 1} ---`);
            console.log(`Date: ${feedback.datetime}`);
            console.log(`User ID: ${feedback.sender}`);
            console.log(`Message: ${feedback.message}`);
            console.log(`Thread: ${feedback.thread}`);
            console.log('');
        });

        console.log(`========================================`);
        console.log(`END OF REPORT - ${snapshot.size} entries total`);
        console.log(`========================================\n`);

        process.exit(0);
    })
    .catch(error => {
        console.error('Error fetching feedback:', error);
        process.exit(1);
    });
