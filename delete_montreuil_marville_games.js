const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function deleteDocuments() {
    const repeatersToDelete = await fetchAndConfirmRepeatersToDelete();
    const gamesToDelete = await fetchAndConfirmGamesToDelete();

    if (repeatersToDelete.length === 0 && gamesToDelete.length === 0) {
        console.log('No documents to delete.');
        return;
    }

    if (repeatersToDelete.length > 0) {
        console.log(`Confirm deletion of ${repeatersToDelete.length} repeater(s):`);
        for (const doc of repeatersToDelete) {
            console.log(doc.id);
        }
        const confirm = await askForConfirmation();
        if (confirm) {
            await deleteRepeaters(repeatersToDelete);
            console.log(`${repeatersToDelete.length} repeater(s) deleted.`);
        } else {
            console.log('Deletion of repeaters canceled.');
        }
    }

    if (gamesToDelete.length > 0) {
        console.log(`Confirm deletion of ${gamesToDelete.length} game(s):`);
        for (const doc of gamesToDelete) {
            console.log(doc.id);
        }
        const confirm = await askForConfirmation();
        if (confirm) {
            await deleteGames(gamesToDelete);
            console.log(`${gamesToDelete.length} game(s) deleted.`);
        } else {
            console.log('Deletion of games canceled.');
        }
    }
}

async function fetchAndConfirmRepeatersToDelete() {
    const repeatersQuery = db.collection('repeaters')
        .where('organizer', 'in', ['1GfAHFfqO6dOj37bPrTRuDS5gnk1', 'u9uC1vjdcdQ3UqNxI0SiFxor0m43']);

    const repeatersSnapshot = await repeatersQuery.get();
    const repeatersToDelete = [];

    repeatersSnapshot.forEach((doc) => {
        repeatersToDelete.push(doc);
    });

    return repeatersToDelete;
}

async function fetchAndConfirmGamesToDelete() {
    const now = new Date();
    const gamesQuery = db.collection('games')
        .where('organizer', 'in', ['1GfAHFfqO6dOj37bPrTRuDS5gnk1', 'u9uC1vjdcdQ3UqNxI0SiFxor0m43'])
        .where('date', '>', now);

    const gamesSnapshot = await gamesQuery.get();
    const gamesToDelete = [];

    gamesSnapshot.forEach((doc) => {
        const attendees = doc.data().attendees;

        if (!attendees || attendees.length === 0) {
            gamesToDelete.push(doc);
        }
    });

    return gamesToDelete;
}

async function askForConfirmation() {
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        readline.question('Are you sure you want to delete these documents? (yes/no): ', (answer) => {
            readline.close();
            resolve(answer.toLowerCase() === 'yes');
        });
    });
}

async function deleteRepeaters(repeatersToDelete) {
    for (const doc of repeatersToDelete) {
        await db.collection('repeaters').doc(doc.id).delete();
    }
}

async function deleteGames(gamesToDelete) {
    for (const doc of gamesToDelete) {
        await db.collection('games').doc(doc.id).delete();
    }
}

deleteDocuments()
    .then(() => {
        console.log('Script completed.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
