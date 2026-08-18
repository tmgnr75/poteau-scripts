const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countAvailabilities() {
    try {
        // Define all possible availabilities
        const availabilities = [
            'MondayMorning', 'MondayNoon', 'MondayAfternoon', 'MondayEvening', 'MondayNight',
            'TuesdayMorning', 'TuesdayNoon', 'TuesdayAfternoon', 'TuesdayEvening', 'TuesdayNight',
            'WednesdayMorning', 'WednesdayNoon', 'WednesdayAfternoon', 'WednesdayEvening', 'WednesdayNight',
            'ThursdayMorning', 'ThursdayNoon', 'ThursdayAfternoon', 'ThursdayEvening', 'ThursdayNight',
            'FridayMorning', 'FridayNoon', 'FridayAfternoon', 'FridayEvening', 'FridayNight',
            'SaturdayMorning', 'SaturdayNoon', 'SaturdayAfternoon', 'SaturdayEvening', 'SaturdayNight',
            'SundayMorning', 'SundayNoon', 'SundayAfternoon', 'SundayEvening', 'SundayNight'
        ];

        // Initialize a map to hold counts for each availability
        let availabilityCounts = new Map(availabilities.map(availability => [availability, 0]));
        availabilityCounts.set('EveryMoment', 0); // Add a special category for 'EveryMoment'

        // Query users where availabilities.filled is true
        const querySnapshot = await db.collection('users')
            .where('availabilities.filled', '==', true)
            .get();

        // Log the number of users with availabilities.filled == true
        console.log(`Number of users with availabilities filled: ${querySnapshot.size}`);

        // Count each occurrence of availability
        querySnapshot.forEach((doc) => {
            const userAvailabilities = doc.data().availabilities.moments;

            // Check if user has selected every moment
            const hasEveryMoment = availabilities.every(val => userAvailabilities.includes(val));

            userAvailabilities.forEach((moment) => {
                if (availabilityCounts.has(moment)) {
                    availabilityCounts.set(moment, availabilityCounts.get(moment) + 1);
                }
            });

            // Increment count for 'EveryMoment' if applicable
            if (hasEveryMoment) {
                availabilityCounts.set('EveryMoment', availabilityCounts.get('EveryMoment') + 1);
            }
        });

        // Log the counts for each availability
        availabilityCounts.forEach((count, availability) => {
            console.log(`${availability}: ${count}`);
        });

        return availabilityCounts;
    } catch (error) {
        console.error('Error counting availabilities:', error);
        throw error;
    }
}

countAvailabilities();