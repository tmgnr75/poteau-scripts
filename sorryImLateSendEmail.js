const admin = require('firebase-admin');
const axios = require('axios');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Direct assignment if running locally (no Firebase Functions env)
const brevoApiKey = process.env.BREVO_API_KEY;
if (!process.env.BREVO_API_KEY) {
    console.error('Missing BREVO_API_KEY in the environment.');
    console.error('Run:  source ~/.poteau/brevo.env');
    process.exit(1);
}


(async () => {
    console.log(`[START] Fetching latest 300 users with connector=email`);

    const snapshot = await db.collection('users')
        .where('connector', '==', 'email')
        .orderBy('created_time', 'desc')
        .limit(300)
        .get();

    console.log(`[INFO] Retrieved ${snapshot.size} users`);

    for (const doc of snapshot.docs) {
        const userId = doc.id;
        const userData = doc.data();

        if (userData.last_onboarding_step !== 'verif_email') {
            console.log(`[SKIP] ${userId} - step is "${userData.last_onboarding_step}"`);
            continue;
        }

        const email = userData.email;
        const code = userData.email_code;
        if (!email || !code) {
            console.log(`[SKIP] ${userId} - missing email or code`);
            continue;
        }

        const payload = {
            to: [{ email }],
            templateId: 1039,
            params: { OTC: code },
        };

        console.log(`[SEND] ${userId} - sending email to ${email}`);

        try {
            const res = await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': brevoApiKey,
                },
            });
            console.log(`[OK] ${userId} - email sent`, res.data);
        } catch (error) {
            console.error(`[FAIL] ${userId} - email error`, error?.response?.data || error.message);
        }
    }

    console.log(`[DONE] All eligible users processed`);
})();