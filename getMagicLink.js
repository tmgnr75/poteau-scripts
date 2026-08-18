const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

async function getMagicLink(email) {
    const encodedEmail = encodeURIComponent(email);

    const actionCodeSettings = {
        url: `https://poteau.app/poteauboost-magiclink?email=${encodedEmail}`,
        handleCodeInApp: false,
    };

    try {
        const link = await admin.auth().generateSignInWithEmailLink(email, actionCodeSettings);
        console.log('\n========================================');
        console.log('🔗 MAGIC LINK GENERATED');
        console.log('========================================');
        console.log(`\nEmail: ${email}`);
        console.log(`\nMagic Link:\n${link}`);
        console.log('\n========================================\n');
        return link;
    } catch (error) {
        console.error('Error generating magic link:', error.message);
        throw error;
    }
}

// Generate magic link for Virginie Renouf
getMagicLink('virginie.renouf@lefive.fr');
