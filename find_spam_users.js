const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const SPAM_PATTERNS = [
    'FtM5rYlhNZZ6GRsAjiu6XP',
    'footfactory.online',
    'FootFactory',
    'id6744173972',  // FootFactory App Store ID
];

function isSpam(text) {
    const lower = text.toLowerCase();
    return SPAM_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

async function findSpamUsers() {
    console.log('Searching for messages containing any of:', SPAM_PATTERNS.join(', '));
    console.log('---');

    const afterDate = new Date('2026-02-01T00:00:00Z');

    const messagesRef = db.collection('messages')
        .where('type', '==', 'message')
        .where('created', '>=', afterDate);
    const snapshot = await messagesRef.get();

    console.log(`Total messages to scan: ${snapshot.size}`);

    // Map: authorId -> { firstMessage, lastMessage }
    const userMap = {};

    snapshot.forEach((doc) => {
        const data = doc.data();
        const text = data.text || '';

        if (isSpam(text)) {
            const authorId = data.author_id;
            if (!authorId) return;

            // author_id is a DocumentReference, get the ID
            const userId = authorId.id || authorId;
            const created = data.created ? data.created.toDate() : null;

            if (!userMap[userId]) {
                userMap[userId] = {
                    firstMessage: created,
                    lastMessage: created,
                    count: 1,
                };
            } else {
                userMap[userId].count++;
                if (created && (!userMap[userId].firstMessage || created < userMap[userId].firstMessage)) {
                    userMap[userId].firstMessage = created;
                }
                if (created && (!userMap[userId].lastMessage || created > userMap[userId].lastMessage)) {
                    userMap[userId].lastMessage = created;
                }
            }
        }
    });

    const userIds = Object.keys(userMap);
    console.log(`\nFound ${userIds.length} unique users who posted spam messages.\n`);

    if (userIds.length === 0) {
        console.log('No spam messages found.');
        return;
    }

    // Fetch user docs to check banned status
    for (const userId of userIds) {
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const banned = userData ? (userData.banned === true) : 'user not found';
        const displayName = userData ? (userData.display_name || 'N/A') : 'N/A';

        const info = userMap[userId];
        console.log(`User: ${userId}`);
        console.log(`  Display Name: ${displayName}`);
        console.log(`  Spam messages count: ${info.count}`);
        console.log(`  First spam message: ${info.firstMessage ? info.firstMessage.toISOString() : 'unknown'}`);
        console.log(`  Last spam message:  ${info.lastMessage ? info.lastMessage.toISOString() : 'unknown'}`);
        console.log(`  Banned: ${banned}`);
        console.log('---');
    }

    console.log('\nUser IDs list:');
    console.log(userIds.join('\n'));
}

findSpamUsers()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Error:', err);
        process.exit(1);
    });
