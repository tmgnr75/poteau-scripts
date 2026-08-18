const admin = require('firebase-admin');
const twilio = require('twilio');

// Firebase setup
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
console.log('[INFO] Firebase initialized');

// Twilio setup
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.error('Missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN in the environment.');
    console.error('Run:  source ~/.poteau/twilio.env');
    process.exit(1);
}

const client = twilio(accountSid, authToken);
console.log('[INFO] Twilio client initialized');

// Message details
const toPhoneNumber = '+33782539393'; // French test number
const fromPhoneNumber = 'Poteau';
const messageBody = `Hey, it’s Tim from Poteau.
You signed up but didn’t join. Mind telling us why? (30 sec) → https://poteau.app/form/miami
Your next game will be refunded if you answer!`;

async function sendSms() {
    try {
        console.log(`[INFO] Sending SMS to ${toPhoneNumber}...`);

        const message = await client.messages.create({
            body: messageBody,
            from: fromPhoneNumber,
            to: toPhoneNumber,
        });

        console.log('[SUCCESS] SMS sent');
        console.log(`[MESSAGE SID] ${message.sid}`);
        console.log(`[STATUS] ${message.status}`);
        console.log(`[TO] ${message.to}`);
        console.log(`[PRICE] ${message.price || 'Unknown at this stage'}`);
    } catch (error) {
        console.error('[ERROR] Failed to send SMS');
        console.error(error.message);
    }
}

sendSms();