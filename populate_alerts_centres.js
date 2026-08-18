const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function populateAlertsCentres() {
    try {
        console.log('Fetching Pro users...');
        const proUsersSnapshot = await db.collection('users').where('type', '==', 'pro').where('centre_plan_status', '!=', 'expired').get();
        console.log(`Fetched ${proUsersSnapshot.size} Pro users.`);

        console.log('Querying alerts...');
        const alertsSnapshot = await db.collection('alerts').get();
        console.log(`Queried ${alertsSnapshot.size} alerts.`);

        console.log('Processing Pro users...');

        for (const proUserDoc of proUsersSnapshot.docs) {
            const proUserData = proUserDoc.data();
            console.log(`Processing ${proUserData.display_name}...`);

            let timeSlots = {};
            for (let i = 1; i <= 7; i++) {
                timeSlots[`weekday_${i}`] = {};
                for (let j = 18; j <= 47; j++) { // Adjusted time range from 09:30 to 23:30
                    const hour = Math.floor(j / 2);
                    const minutes = j % 2 === 0 ? '00' : '30';
                    const time = `${String(hour).padStart(2, '0')}:${minutes}`;
                    const timeKey = `time_${time.replace(':', '-')}`; // Modified time key format
                    timeSlots[`weekday_${i}`][timeKey] = 0; // Initialize count to 0
                }
            }

            alertsSnapshot.forEach(alertDoc => {
                const alertData = alertDoc.data();
                alertData.weekdays.forEach(weekday => {
                    const weekdayKey = `weekday_${weekday}`;
                    alertData.times.forEach(time => {
                        const timeKey = `time_${time.replace(':', '-')}`; // Modified time key format
                        if (timeSlots[weekdayKey][timeKey] !== undefined) {
                            // Increment the count if the alert matches the pro user
                            if (
                                (alertData.places.some(place => place.placeId === proUserData.centre_place_id)) ||
                                (alertData.places.some(place => place.centre === proUserData.display_name))
                            ) {
                                timeSlots[weekdayKey][timeKey]++;
                            }
                        }
                    });
                });
            });

            // Track unique alerts for total count
            let uniqueAlertIds = new Set();
            alertsSnapshot.forEach(alertDoc => {
                const alertData = alertDoc.data();
                const matchesCentre = alertData.places.some(place =>
                    place.placeId === proUserData.centre_place_id || place.centre === proUserData.display_name
                );
                if (matchesCentre) {
                    uniqueAlertIds.add(alertDoc.id);
                }
            });
            const totalUniqueAlerts = uniqueAlertIds.size;

            // Check if the document already exists for the pro user
            const centresSnapshot = await db.collection('alerts_centres').where('user', '==', proUserDoc.ref).get();
            if (!centresSnapshot.empty) {
                console.log(`Updating existing document for user: ${proUserDoc.ref.id}`);
                const centreRef = centresSnapshot.docs[0].ref;
                await centreRef.update({
                    time_slots: timeSlots,
                    total_unique_alerts: totalUniqueAlerts,
                    last_edited: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Document updated: ${proUserData.display_name}`);
            } else {
                console.log(`Creating new document for user: ${proUserDoc.ref.id}`);
                const newCentreRef = await db.collection('alerts_centres').add({
                    centre: proUserData.display_name,
                    place_id: proUserData.centre_place_id,
                    time_slots: timeSlots,
                    total_unique_alerts: totalUniqueAlerts,
                    user: proUserDoc.ref,
                    last_edited: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`New document created: ${proUserData.display_name}, Document ID: ${newCentreRef.id}`);
            }
        }

        console.log('Process completed successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function to execute
populateAlertsCentres();
