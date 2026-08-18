/**
 * Migrate a user from Apple Sign-In to Email/Password auth.
 *
 * Context: users who signed up with "Sign in with Apple" have no password provider
 * on their Firebase Auth account. On Android (no Apple button), the email/password
 * form silently fails to send password reset emails because there's no password
 * credential to reset.
 *
 * This script:
 *   1. Looks up the user by their current Auth email (often a privaterelay.appleid.com).
 *   2. Optionally updates their email to a real address (so reset/login works).
 *   3. Generates a password reset link and prints it (forward it to the user).
 *
 * The Apple provider stays linked. The next time they're on iOS, "Sign in with Apple"
 * still works. On Android, they can now use email + the password they set via the link.
 *
 * Usage:
 *   node migrate_apple_to_email.js <currentEmail> [newEmail]
 *
 * Examples:
 *   node migrate_apple_to_email.js k6zs28p82n@privaterelay.appleid.com
 *   node migrate_apple_to_email.js k6zs28p82n@privaterelay.appleid.com benkezzimfarid213@gmail.com
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const currentEmail = process.argv[2];
const newEmail = process.argv[3];

if (!currentEmail) {
    console.error('Usage: node migrate_apple_to_email.js <currentEmail> [newEmail]');
    process.exit(1);
}

async function main() {
    // 1. Look up user by current email
    let authUser;
    try {
        authUser = await admin.auth().getUserByEmail(currentEmail);
    } catch (e) {
        console.error(`[ERROR] Auth user not found for email: ${currentEmail}`);
        console.error(e.message);
        process.exit(1);
    }
    const uid = authUser.uid;
    console.log(`[FOUND] uid: ${uid}`);
    console.log(`[FOUND] providers: ${authUser.providerData.map(p => p.providerId).join(', ')}`);

    // 2. If a new email is provided AND different, check it's not already used
    let finalEmail = currentEmail;
    if (newEmail && newEmail !== currentEmail) {
        try {
            const existing = await admin.auth().getUserByEmail(newEmail);
            console.error(`[ABORT] ${newEmail} is already used by another Auth user (uid: ${existing.uid}).`);
            console.error('Resolve the conflict manually before running this script.');
            process.exit(1);
        } catch (e) {
            if (e.code !== 'auth/user-not-found') {
                console.error(`[ERROR] Unexpected error checking ${newEmail}:`, e.message);
                process.exit(1);
            }
            // Good: email is free.
        }

        console.log(`[STEP] Updating Auth email: ${currentEmail} -> ${newEmail}`);
        await admin.auth().updateUser(uid, { email: newEmail, emailVerified: false });
        console.log('[AUTH UPDATED]');

        // Mirror to Firestore
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            await db.collection('users').doc(uid).update({ email: newEmail });
            console.log('[FIRESTORE UPDATED]');
        } else {
            console.log('[WARN] No Firestore users/<uid> doc — skipped firestore email update.');
        }
        finalEmail = newEmail;
    }

    // 3. Generate password reset link.
    // Note: this works even if the user has no `password` provider yet — clicking
    // the link sets the password and adds the password provider to the account.
    const link = await admin.auth().generatePasswordResetLink(finalEmail);
    console.log('\n=== PASSWORD RESET LINK (forward to user) ===');
    console.log(link);
    console.log('\nThe link sets a password on the existing account and adds the password provider.');
    console.log('Apple Sign-In will still work on iOS afterwards.');

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
