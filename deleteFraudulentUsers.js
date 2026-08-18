const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const auth = admin.auth();

// List of fraudulent users' document IDs
const fraudulentUserIds = [
    'yGE14VNJr8Sj4Id5QB5nB6YvHt73',
    'B7BUn93tXjbxJ4RQG5WZQQz2FA62',
    'mTIhxy8G0sSTvr4WEkCbAd8e0G63',
    '2NE84RS3uWT5KBKQ5wN1HsXSKvk2',
    'CfNdY19hjDeeLhc8sCZPX65CHA62',
    'anOEv8EkBeg1X9bRQIzmsgV0as63',
    '2T6oLrPGrKeTj27ory5VItG4E463',
    'a2gjDrUVcdShkP8BWzuW8Z2Kt7Z2',
    'jrbJWaHiKQNvFmT3AgneABBg4sX2',
    'MJS14JpUq1XpGelOEb4HRrJmq8H3',
    'uv7TfOEVFmWDZrTK8hQ0z6o2WRB2',
    'HlW8SQTNOgO2hr3QvBmjqxZx1CG3',
    '9TeeR1yTFAaBZrkRKy1sFImFwU93',
    'cJxkrXnMByOScdvx6wlQEFfh9E43',
    'uXvCCqiH4ognBaUIlUtm0AlJsoG2'
];

// List of emails to find corresponding users
const fraudulentEmails = [];

// Function to log actions
function logAction(message) {
    console.log(`[LOG] ${new Date().toISOString()} - ${message}`);
}

// Function to disable user authentication in Firebase
async function disableUserAccount(uid) {
    try {
        await auth.updateUser(uid, { disabled: true });
        logAction(`Disabled user account for UID: ${uid}`);
    } catch (error) {
        logAction(`Error disabling user account for UID: ${uid} - ${error.message}`);
    }
}

// Function to delete user document
async function deleteUserDocument(uid) {
    try {
        await db.collection('users').doc(uid).delete();
        logAction(`Deleted user document for UID: ${uid}`);
    } catch (error) {
        logAction(`Error deleting user document for UID: ${uid} - ${error.message}`);
    }
}

// Function to delete documents from the messenger collection
async function deleteMessengerDocuments(uid) {
    try {
        const messengerSnapshot = await db.collection('messenger')
            .where('conversation_with', '==', db.doc(`users/${uid}`))
            .get();

        const batch = db.batch();
        messengerSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        logAction(`Deleted messenger documents for UID: ${uid}`);
    } catch (error) {
        logAction(`Error deleting messenger documents for UID: ${uid} - ${error.message}`);
    }
}

// Function to remove user from "attendees" and "interested" arrays in the games collection
async function removeFromGames(uid) {
    try {
        // Query for games where the user is in the attendees array
        const attendeesSnapshot = await db.collection('games')
            .where('attendees', 'array-contains', uid)
            .get();

        // Query for games where the user is in the interested array
        const interestedSnapshot = await db.collection('games')
            .where('interested', 'array-contains', uid)
            .get();

        const batch = db.batch();

        // Remove user from attendees
        attendeesSnapshot.forEach(doc => {
            const updatedAttendees = doc.data().attendees.filter(id => id !== uid);
            batch.update(doc.ref, { attendees: updatedAttendees });
            logAction(`Removed UID: ${uid} from attendees in game ${doc.id}`);
        });

        // Remove user from interested
        interestedSnapshot.forEach(doc => {
            const updatedInterested = doc.data().interested.filter(id => id !== uid);
            batch.update(doc.ref, { interested: updatedInterested });
            logAction(`Removed UID: ${uid} from interested in game ${doc.id}`);
        });

        await batch.commit();
        logAction(`Processed games collection for UID: ${uid}`);
    } catch (error) {
        logAction(`Error processing games collection for UID: ${uid} - ${error.message}`);
    }
}

// Function to process a user by their UID (disable account, delete documents)
async function processUser(uid) {
    logAction(`Starting to process UID: ${uid}`);
    await disableUserAccount(uid);
    await deleteUserDocument(uid);
    await deleteMessengerDocuments(uid);
    logAction(`Finished processing UID: ${uid}`);
}

// Function to process users by email (remove from games)
async function processUsersByEmail() {
    if (fraudulentEmails.length === 0) {
        logAction('No fraudulent emails provided. Skipping email processing.');
        return;
    }

    logAction(`Starting to process users by email`);
    for (const email of fraudulentEmails) {
        try {
            const userSnapshot = await db.collection('users').where('email', '==', email).get();
            if (!userSnapshot.empty) {
                const userDoc = userSnapshot.docs[0];
                const uid = userDoc.id;
                logAction(`Found UID: ${uid} for email: ${email}`);
                await processUser(uid);
                await removeFromGames(uid); // Only process games for users found by email
            } else {
                logAction(`No user found with email: ${email}`);
            }
        } catch (error) {
            logAction(`Error processing user for email: ${email} - ${error.message}`);
        }
    }
    logAction(`Finished processing users by email`);
}

// Function to process fraudulent user IDs (without removing from games)
async function processFraudulentUsers() {
    if (fraudulentUserIds.length === 0) {
        logAction('No fraudulent user IDs provided. Skipping user ID processing.');
        return;
    }

    logAction(`Starting to process fraudulent users`);
    for (const uid of fraudulentUserIds) {
        await processUser(uid); // No game processing for fraudulent IDs
    }
    logAction(`Finished processing fraudulent users`);
}

// Main function to run the script
async function run() {
    await processFraudulentUsers();
    await processUsersByEmail();
}

run().catch(error => {
    logAction(`Script failed with error: ${error.message}`);
});