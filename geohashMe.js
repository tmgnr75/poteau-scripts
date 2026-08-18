const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID
const geofire = require('geofire-common');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateUserGeoHash(userId) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log(`User with ID ${userId} not found.`);
            return;
        }

        const userData = doc.data();

        // Assuming the user has 'last_location' field with latitude and longitude
        if (userData.last_location && userData.last_location.latitude && userData.last_location.longitude) {
            const geoHash = geofire.geohashForLocation([userData.last_location.latitude, userData.last_location.longitude]);

            // Update the user document with the new GeoHash
            await userRef.update({ geoHash });
            console.log(`GeoHash updated for user with ID ${userId}`);
        } else {
            console.log(`Location data not available for user with ID ${userId}`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Update GeoHash for a specific user
const userId = 'Wy5RXZJefwOZfAKG4MvOS6raU2f2'; // Replace with the target user ID
updateUserGeoHash(userId);