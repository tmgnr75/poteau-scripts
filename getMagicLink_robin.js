const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const EMAIL = 'robin.fuertes@orange.fr';

async function main() {
    // Password reset link
    try {
        const resetLink = await admin.auth().generatePasswordResetLink(EMAIL, {
            url: 'https://poteau.app',
            handleCodeInApp: false,
        });
        console.log('\n=== PASSWORD RESET LINK ===');
        console.log(resetLink);
    } catch (e) {
        console.log('Reset link error:', e.message);
    }

    // Magic sign-in link (fallback)
    try {
        const encodedEmail = encodeURIComponent(EMAIL);
        const magicLink = await admin.auth().generateSignInWithEmailLink(EMAIL, {
            url: `https://poteau.app/poteauboost-magiclink?email=${encodedEmail}`,
            handleCodeInApp: false,
        });
        console.log('\n=== MAGIC SIGN-IN LINK ===');
        console.log(magicLink);
    } catch (e) {
        console.log('Magic link error:', e.message);
    }

    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
