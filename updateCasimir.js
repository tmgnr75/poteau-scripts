const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateAuthEmail(userId, currentEmail, newEmail) {
    try {
        // Get the user by ID
        const userRecord = await admin.auth().getUser(userId);

        // Verify if the current email matches
        if (userRecord.email !== currentEmail) {
            throw new Error("Current email does not match user's email.");
        }

        // Update the user's email
        await admin.auth().updateUser(userId, {
            email: newEmail
        });

        console.log("User email updated successfully.");

        return "User email updated successfully.";
    } catch (error) {
        console.error("Error updating user email:", error.message);
        throw error;
    }
}

// Example usage:
const userId = "NsFLBzMXsYNrthJ2OjFCbTHXDbP2";
const currentEmail = "ev.casimir@yahoo.com";
const newEmail = "ev.casimir@yahoo.fr";

updateAuthEmail(userId, currentEmail, newEmail)
    .then(() => {
        console.log("Email update process completed.");
    })
    .catch((error) => {
        console.error("Email update process failed:", error.message);
    });