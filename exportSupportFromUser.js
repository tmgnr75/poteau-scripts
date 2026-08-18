const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Constants
const TEAM_APP_REF = db.doc('/users/Team-App');
const SENDER_REFS = [
    db.doc('/users/nVlGZ0n3KSX2ILRDfixvXfZgVdG3'),
    db.doc('/users/MESNZi9WVlUf32JLSPqi87t98T13'),
];
const SIXTY_DAYS_AGO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

(async () => {
    console.log(`[START] Querying connect documents:
  - recipient includes: ${TEAM_APP_REF.path}
  - sender in: ${SENDER_REFS.map(ref => ref.path).join(', ')}
  - datetime > ${SIXTY_DAYS_AGO.toISOString()}\n`);

    let totalFound = 0;

    for (const senderRef of SENDER_REFS) {
        console.log(`[QUERY] Sender: ${senderRef.path}`);

        const snapshot = await db.collection('connect')
            .where('recipient', 'array-contains', TEAM_APP_REF)
            .where('sender', '==', senderRef)
            .where('datetime', '>', admin.firestore.Timestamp.fromDate(SIXTY_DAYS_AGO))
            .orderBy('datetime', 'asc')
            .get();

        if (snapshot.empty) {
            console.log(`[INFO] No results for sender: ${senderRef.path}\n`);
            continue;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            const datetime = data.datetime?.toDate?.().toISOString() || 'N/A';
            const message = data.message || '(no message)';

            console.log(`\n[✅ MATCH] Connect ID: ${doc.id}`);
            console.log(`├── datetime: ${datetime}`);
            console.log(`├── sender: ${senderRef.path}`);
            console.log(`└── message: ${message}`);
            totalFound++;
        });

        console.log(`[INFO] Finished processing sender: ${senderRef.path}\n`);
    }

    console.log(`\n[COMPLETE] Total matching connect documents printed: ${totalFound}`);
})();