const admin = require('firebase-admin');
const { DateTime } = require('luxon'); // Install via: npm install luxon
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const TIME_ZONE = 'Europe/Paris';
const START_DATE = '2026-03-01T00:00:00';
const END_DATE = '2026-04-01T00:00:00';

(async () => {
    try {
        console.log(`\n[INFO] Starting Firestore query for games...`);
        console.log(`[INFO] Time zone: ${TIME_ZONE}`);
        console.log(`[INFO] Date range: from ${START_DATE} to ${END_DATE}`);

        const start = DateTime.fromISO(START_DATE, { zone: TIME_ZONE }).toJSDate();
        const end = DateTime.fromISO(END_DATE, { zone: TIME_ZONE }).toJSDate();

        const snapshot = await db.collection('games')
            .where('date', '>=', start)
            .where('date', '<', end)
            .where('payment_type', '==', 'in-app')
            .where('status', '==', 'played')
            .get();

        console.log(`[INFO] Total matching documents: ${snapshot.size}\n`);

        if (snapshot.empty) {
            console.log('[INFO] No documents found.');
            return;
        }

        const results = [];

        snapshot.forEach(doc => {
            const data = doc.data();

            if (!data.time_zone) {
                console.warn(`[WARN] Missing time_zone for game ID ${doc.id}. Defaulting to ${TIME_ZONE}.`);
            }

            const effectiveTimeZone = data.time_zone || TIME_ZONE;
            const dateTime = DateTime.fromJSDate(data.date.toDate(), { zone: effectiveTimeZone });
            const formattedDate = dateTime.toFormat('MM/dd/yyyy');
            const formattedTime = dateTime.toFormat('HH:mm');
            const rawPrice = typeof data.price === 'number' ? data.price : 0;
            const maxPlayers = typeof data.max_players === 'number' ? data.max_players : 0;
            const currency = data.currency || '';
            const totalPrice = (rawPrice * maxPlayers).toFixed(2);

            results.push({
                id: doc.id,
                centre: data.centre || '',
                date: formattedDate,
                time: formattedTime,
                price: totalPrice,
                currency: currency,
                payment_type: 'in-app',
                status: 'played'
            });
        });

        console.log(JSON.stringify(results, null, 2));

        console.log('\n[INFO] Script completed successfully.\n');
    } catch (err) {
        console.error('[ERROR] Something went wrong:', err);
    }
})();