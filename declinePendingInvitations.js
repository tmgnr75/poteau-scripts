const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Constants
const TARGET_USER_ID = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const TARGET_STATUS = "pending";
const NEW_STATUS = "declined";

async function declinePendingInvitations() {
    console.log("Starting process to update 'pending' game invitations to 'declined'...");

    try {
        // Create a reference to the target user document
        const targetUserRef = db.collection('users').doc(TARGET_USER_ID);
        console.log(`Target user reference created for user ID: ${TARGET_USER_ID}`);

        const invitationsRef = db.collection('game_invitations');
        const querySnapshot = await invitationsRef
            .where('status', '==', TARGET_STATUS)
            .where('invitee', '==', targetUserRef)
            .get();

        console.log(`Found ${querySnapshot.size} invitations with status '${TARGET_STATUS}' for invitee '${targetUserRef.path}'.`);

        if (querySnapshot.empty) {
            console.log("No matching invitations found. Exiting the process.");
            return;
        }

        let updatedCount = 0;

        // Process each invitation
        for (const doc of querySnapshot.docs) {
            const invitationData = doc.data();
            console.log(`Processing invitation ID: ${doc.id}, current status: ${invitationData.status}, invitee: ${invitationData.invitee.path}`);

            // Update the status
            await doc.ref.update({ status: NEW_STATUS });
            updatedCount++;
            console.log(`Invitation ID: ${doc.id} successfully updated to status '${NEW_STATUS}'`);
        }

        console.log(`Process completed. Total invitations updated: ${updatedCount}`);
    } catch (error) {
        console.error("An error occurred during the update process:", error);
    }
}

declinePendingInvitations();