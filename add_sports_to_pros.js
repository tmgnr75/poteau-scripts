const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function addSportsToPros() {
    try {
        const usersSnapshot = await db.collection('users').where('type', '==', 'pro').get();

        if (usersSnapshot.empty) {
            console.log('No pro users found.');
            return;
        }

        const batch = db.batch();
        let updateCount = 0;
        let skippedCount = 0;

        const soccerPadelNames = ['montreuil', 'stadium thiais', 'stadium antibes', 'le five créteil'];

        usersSnapshot.forEach(userDoc => {
            const userData = userDoc.data();
            const userRef = db.collection('users').doc(userDoc.id);
            const displayName = userData.display_name || '';
            const displayNameLower = displayName.toLowerCase();

            let sportsValue;

            // Check if display_name matches soccer + padel venues
            const isSoccerPadel = soccerPadelNames.some(name => displayNameLower.includes(name));
            // Check if display_name contains "4padel"
            const isPadelOnly = displayNameLower.includes('4padel');

            if (isSoccerPadel) {
                sportsValue = ['soccer', 'padel'];
            } else if (isPadelOnly) {
                sportsValue = ['padel'];
            } else {
                sportsValue = ['soccer'];
            }

            batch.update(userRef, { sports: sportsValue });
            console.log(`Updated: ${userData.display_name} -> sports: ${JSON.stringify(sportsValue)}`);
            updateCount++;
        });

        if (updateCount > 0) {
            await batch.commit();
        }

        console.log(`\nDone! Updated: ${updateCount}, Skipped: ${skippedCount}`);
    } catch (error) {
        console.error('Error updating users:', error);
    } finally {
        admin.app().delete();
    }
}

addSportsToPros();
