/**
 * Delete a Firebase Auth user and their Firestore users/<uid> document.
 * Used to resolve duplicate-account situations.
 *
 * Usage: node delete_user_account.js <uid>
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const uid = process.argv[2];
if (!uid) {
    console.error('Usage: node delete_user_account.js <uid>');
    process.exit(1);
}

async function main() {
    console.log(`[STEP] Deleting Firebase Auth user: ${uid}`);
    try {
        await admin.auth().deleteUser(uid);
        console.log('[AUTH DELETED]');
    } catch (e) {
        console.error('[AUTH DELETE ERROR]', e.message);
    }

    const docRef = db.collection('users').doc(uid);
    const snap = await docRef.get();
    if (snap.exists) {
        await docRef.delete();
        console.log(`[FIRESTORE DELETED] users/${uid}`);
    } else {
        console.log(`[FIRESTORE] No users/${uid} doc to delete.`);
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
