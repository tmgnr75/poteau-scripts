/**
 * Poteau | Find suspicious accounts with salah + number @gmail.com
 * Usage:
 *   node findSalahEmails.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function main() {
    console.log(`[START] Searching for salah+number@gmail.com accounts…`);

    // Firestore trick: query emails starting with "salah"
    const snap = await db.collection('users')
        .where('email', '>=', 'salah')
        .where('email', '<', 'salah' + '\uf8ff')
        .get();

    if (snap.empty) {
        console.log(`[DONE] No salah* emails found.`);
        return;
    }

    console.log(`[INFO] Found ${snap.size} candidate(s). Checking pattern…`);

    const results = [];
    snap.forEach(doc => {
        const data = doc.data() || {};
        const email = data.email || '';
        if (/^salah\d+@gmail\.com$/i.test(email)) {
            results.push({
                userId: doc.id,
                email,
                banned: data.banned === true,
            });
        }
    });

    if (results.length === 0) {
        console.log(`[DONE] No exact salah+number@gmail.com accounts found.`);
    } else {
        console.log(`[RESULTS] Exact matches: ${results.length}`);
        console.table(results);
    }
}

main().catch(err => {
    console.error(`[FATAL] ${err.message}`);
    process.exit(1);
});