const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const TEAM_APP_REF = db.doc('/users/Team-App');
const START_DATE = new Date('2024-06-10T00:00:00Z');

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0 (Sun) to 6 (Sat)
    const diff = (day + 6) % 7; // days since Monday
    d.setUTCDate(d.getUTCDate() - diff);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

(async () => {
    console.log(`[START] Querying connect documents with recipient Team-App since ${START_DATE.toISOString()}\n`);

    try {
        const snapshot = await db.collection('connect')
            .where('recipient', 'array-contains', TEAM_APP_REF)
            .where('datetime', '>', admin.firestore.Timestamp.fromDate(START_DATE))
            .get();

        const weeklyMap = new Map();

        snapshot.forEach(doc => {
            const data = doc.data();
            const datetime = data.datetime?.toDate?.();
            const message = data.message;
            const sender = data.sender;

            if (!datetime || !message || !sender?.path) return;

            const weekKey = getWeekStart(datetime);
            const senderPath = sender.path;
            const uniqueKey = `${message}::${senderPath}`;

            if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, new Set());
            weeklyMap.get(weekKey).add(uniqueKey);
        });

        console.log('week_start,unique_message_sender_pairs');
        const sortedWeeks = [...weeklyMap.keys()].sort();
        for (const week of sortedWeeks) {
            const count = weeklyMap.get(week).size;
            console.log(`${week},${count}`);
        }

        console.log('\n[COMPLETE] Weekly unique (message, sender) counts printed.');
    } catch (error) {
        console.error('[ERROR] Firestore query failed:', error);
    }
})();