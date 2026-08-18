const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';
const geoTz = require('geo-tz');
const moment = require('moment-timezone');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Function to simulate matching alerts for a given game ID
async function simulateMatchingAlerts(gameId) {
    try {
        // Retrieve game data
        const gameSnapshot = await db.collection('games').doc(gameId).get();
        const gameData = gameSnapshot.data();

        // Check if the game visibility is private initially
        if (gameData.visibility === 'private') {
            console.log('Game visibility is private. Skipping invitation creation.');
            return [];
        } else if (gameData.status !== 'published') {
            console.log(`Game status is ${gameData.status}. Skipping invitation creation.`);
            return [];
        }

        // Use geoTz to find the timezone based on gameData.location
        const timeZones = geoTz.find(gameData.location.latitude, gameData.location.longitude);
        const timeZone = timeZones.length > 0 ? timeZones[0] : 'UTC'; // Use the first timezone or 'UTC' as a fallback

        // Adjust game date to the local time zone
        const gameDate = moment(gameData.date.toDate()).tz(timeZone);
        const dayOfWeek = gameDate.day() === 0 ? 7 : gameDate.day(); // Adjusting 0 (Sunday) to 7 to match your logic
        const gameTime = gameDate.format('HH:mm');

        console.log('Adjusted Game Date:', gameDate);
        console.log('Adjusted Game Time:', gameTime);
        console.log('Day of the Week:', dayOfWeek);

        // Retrieve alerts matching the game's time
        const timeQuery = db.collection('alerts').where('times', 'array-contains', gameTime);
        const timeSnapshot = await timeQuery.get();
        console.log('Retrieved Alerts with matching Time:', timeSnapshot.size);

        let matchingAlertsIds = [];

        // Filter out alerts that match the day of the week
        timeSnapshot.docs.forEach(alertDoc => {
            const alertData = alertDoc.data();
            const weekdays = alertData.weekdays || [];
            if (weekdays.includes(dayOfWeek)) {
                const places = alertData.places || [];
                places.forEach(place => {
                    if (gameData.place_id && place.placeId === gameData.place_id) {
                        matchingAlertsIds.push(alertDoc.id);
                    } else if (gameData.centre && place.centre === gameData.centre) {
                        matchingAlertsIds.push(alertDoc.id);
                    }
                });
            }
        });

        console.log('Matching Alerts:', matchingAlertsIds);
        return matchingAlertsIds;
    } catch (error) {
        console.error('Error simulating matching alerts:', error);
        return [];
    }
}

// Example usage: Simulate matching alerts for a given game ID
const gameId = 'wE1TcpASHiyjXU58i36r';
simulateMatchingAlerts(gameId);