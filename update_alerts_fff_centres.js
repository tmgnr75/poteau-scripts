const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function updateCentreInAlerts() {
    try {
        // Define old and new values
        const oldValue = 'Centre FFF Dijon - Foot 5';
        const newValue = 'Foot 5 Dijon • FFF';

        // Fetch "alerts" docs where any place in the places array has centre == oldValue
        const alertsSnapshot = await db.collection('alerts')
            .where('places', 'array-contains', { centre: oldValue })
            .get();

        if (alertsSnapshot.empty) {
            console.log('No matching alerts documents found.');
            return;
        }

        const batch = db.batch();
        let alertsCount = 0;

        alertsSnapshot.forEach(doc => {
            const data = doc.data();
            const places = data.places;

            // Check and update each place in the places array where the centre matches the old value
            const updatedPlaces = places.map(place => {
                if (place.centre === oldValue) {
                    return {
                        ...place,
                        centre: newValue
                    };
                }
                return place;
            });

            // Only update if a replacement has occurred
            if (JSON.stringify(places) !== JSON.stringify(updatedPlaces)) {
                const docRef = doc.ref;
                batch.update(docRef, { places: updatedPlaces });
                alertsCount++;
            }
        });

        // Commit the batch update
        await batch.commit();
        console.log(`Updated ${alertsCount} alerts documents where places contained the centre: ${oldValue}`);
    } catch (error) {
        console.error('Error during batch update:', error);
    }
}

updateCentreInAlerts().then(() => {
    console.log('Alerts centre update process finished.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});