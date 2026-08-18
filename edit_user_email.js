const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Function to find user by email and update both Auth and Firestore
async function updateUserEmail(oldEmail, newEmail) {
    try {
        // 1. Find user by old email in Firebase Auth
        const userRecord = await admin.auth().getUserByEmail(oldEmail);
        const uid = userRecord.uid;
        console.log(`[FOUND] User: ${userRecord.displayName || 'N/A'} | UID: ${uid} | Current Auth email: ${userRecord.email}`);

        // 2. Check Firestore document
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            console.log(`[FIRESTORE] display_name: ${data.display_name} | email: ${data.email}`);
        } else {
            console.log(`[WARNING] No Firestore document found for UID: ${uid}`);
        }

        // 3. Update Firebase Auth email
        await admin.auth().updateUser(uid, { email: newEmail });
        console.log(`[AUTH UPDATED] Email changed to: ${newEmail}`);

        // 4. Update Firestore email field
        if (userDoc.exists) {
            await db.collection('users').doc(uid).update({ email: newEmail });
            console.log(`[FIRESTORE UPDATED] Email changed to: ${newEmail}`);
        }

        console.log(`\n[DONE] Email successfully updated for user ${uid} from ${oldEmail} to ${newEmail}`);
    } catch (error) {
        console.error(`[ERROR]`, error.message);
    }
}

// Inspect the duplicate account using the new email
async function inspectAccount(email) {
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        console.log(`\n=== ACCOUNT WITH EMAIL: ${email} ===`);
        console.log(`[AUTH] UID: ${uid}`);
        console.log(`[AUTH] Display Name: ${userRecord.displayName || 'N/A'}`);
        console.log(`[AUTH] Created: ${userRecord.metadata.creationTime}`);
        console.log(`[AUTH] Last Sign In: ${userRecord.metadata.lastSignInTime}`);

        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            console.log(`\n[FIRESTORE] display_name: ${data.display_name || 'N/A'}`);
            console.log(`[FIRESTORE] email: ${data.email || 'N/A'}`);
            console.log(`[FIRESTORE] type: ${data.type || 'N/A'}`);
            console.log(`[FIRESTORE] last_activity_date: ${data.last_activity_date ? data.last_activity_date.toDate() : 'N/A'}`);
            console.log(`[FIRESTORE] created_time: ${data.created_time ? data.created_time.toDate() : 'N/A'}`);
            console.log(`[FIRESTORE] gold_status: ${data.gold_status || 'N/A'}`);

            // Check games played
            const gamesAsAttendee = await db.collection('games')
                .where('attendees', 'array-contains', db.doc(`users/${uid}`))
                .get();
            console.log(`[GAMES] Games as attendee: ${gamesAsAttendee.size}`);
        } else {
            console.log(`[FIRESTORE] No document found for UID: ${uid}`);
        }
    } catch (error) {
        console.error(`[ERROR]`, error.message);
    }
}

// Step 1: Delete duplicate account, then migrate email on main account
(async () => {
    const duplicateUid = 'VaPq8eZ5B1dRjZnJLzJGQclgodH3';
    const mainOldEmail = 'mamadou.tamoura@boulanger.com';
    const newEmail = 'tamouramamadou94@gmail.com';

    // 1. Delete duplicate from Firebase Auth
    console.log(`\n[STEP 1] Deleting duplicate Auth account: ${duplicateUid}`);
    await admin.auth().deleteUser(duplicateUid);
    console.log(`[AUTH DELETED] Duplicate account removed`);

    // 2. Delete duplicate Firestore document
    const dupDoc = await db.collection('users').doc(duplicateUid).get();
    if (dupDoc.exists) {
        await db.collection('users').doc(duplicateUid).delete();
        console.log(`[FIRESTORE DELETED] Duplicate user document removed`);
    }

    // 3. Now migrate email on the main account
    console.log(`\n[STEP 2] Migrating email on main account...`);
    await updateUserEmail(mainOldEmail, newEmail);
})();