const admin = require('firebase-admin');
const moment = require('moment');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
    console.log('[START] Counting "reminders" connect documents for the last 10 full days (excluding today)...');

    const today = moment().startOf('day');
    const results = [];

    let total = 0;

    for (let i = 10; i >= 1; i--) {
        const dayStart = today.clone().subtract(i - 1, 'days');
        const dayEnd = dayStart.clone().endOf('day');

        console.log(`\n[INFO] Processing day: ${dayStart.format('YYYY-MM-DD')}`);
        console.log(`[INFO] Time range: ${dayStart.toDate().toISOString()} to ${dayEnd.toDate().toISOString()}`);

        try {
            const snapshot = await db.collection('connect')
                .where('datetime', '>=', admin.firestore.Timestamp.fromDate(dayStart.toDate()))
                .where('datetime', '<=', admin.firestore.Timestamp.fromDate(dayEnd.toDate()))
                .where('source', '==', 'reminders')
                .get();

            const count = snapshot.size;
            results.push({ date: dayStart.format('DD-MM-YYYY'), count });
            console.log(`[RESULT] ${count} documents found for ${dayStart.format('YYYY-MM-DD')}`);
            total += count;
        } catch (error) {
            console.error(`[ERROR] Failed to process ${dayStart.format('YYYY-MM-DD')}:`, error.message);
        }
    }

    console.log('\n[SUMMARY] Daily counts:');
    results.forEach(r => console.log(`${r.date}: ${r.count} reminders`));

    console.log(`\n[SUMMARY] Total reminders over last 10 days: ${total}`);
    console.log('[END]');
})();