const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});


// Function to add documents to the "cached_centres" collection
async function addDocumentsToCachedCentres() {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        const centreData = [
            { centre_name: "Anse Foot", centre_place_id: "ChIJc_uyt2s92jERFAD6KeKs66c", centre_location: new admin.firestore.GeoPoint(45.9498454, 4.7368653) },
            { centre_name: "Chelsea Piers", centre_place_id: "ChIJNcurQqBZwokRYDgoFu6QXCI", centre_location: new admin.firestore.GeoPoint(40.7481792, -74.0111891) },
            { centre_name: "Futbol Futbol Artigues", centre_place_id: "ChIJZziKe5cvVQ0R5tJa9BeDd8o", centre_location: new admin.firestore.GeoPoint(44.8685685, -0.5712569) },
            { centre_name: "Urban Soccer 5 Center", centre_place_id: "ChIJ-zWdGc7SwoARv4eN0GcHeyw", centre_location: new admin.firestore.GeoPoint(33.909868, -119.1336988) },
            { centre_name: "LAB FIVE SOCCER - GARDENA", centre_place_id: "ChIJYTdldJm1woAReOjW_rwNSkU", centre_location: new admin.firestore.GeoPoint(33.9187101, -118.4756534) },
            { centre_name: "LAB FIVE SOCCER - PACOIMA", centre_place_id: "ChIJfzPcqtaRwoARXvzkvoBBQ5Y", centre_location: new admin.firestore.GeoPoint(34.2480354, -118.4095802) },
            { centre_name: "Massilia Five", centre_place_id: "ChIJxZ6UmMW-yRIR7ot5DChYj4w", centre_location: new admin.firestore.GeoPoint(43.2887115, 5.4478345) },
            { centre_name: "Northridge Futsal", centre_place_id: "ChIJBTa6FXebwoARpBWTlIVZOSY", centre_location: new admin.firestore.GeoPoint(34.2371721, -118.5713859) },
            { centre_name: "Soccer Center", centre_place_id: "ChIJWbH3tXW6FkgRHdcPREqDrwA", centre_location: new admin.firestore.GeoPoint(48.419831, -4.4206516) },
            { centre_name: "Soccer Rooftop", centre_place_id: "ChIJATah1RUX2jERAQV1-6wbBpM", centre_location: new admin.firestore.GeoPoint(25.7687609, -80.1906874) },
            { centre_name: "Socceroof Crown Heights", centre_place_id: "ChIJ_wfNJBVdwokRoU3ZUxM4oTc", centre_location: new admin.firestore.GeoPoint(40.6774413, -73.9342119) },
            { centre_name: "Socceroof LIC", centre_place_id: "ChIJ5QHjQedfwokRcvhei27HV1o", centre_location: new admin.firestore.GeoPoint(40.754039, -73.9271867) },
            { centre_name: "Socceroof New Rochelle", centre_place_id: "ChIJcTtBl5GNwokRUooEpetsCCc", centre_location: new admin.firestore.GeoPoint(40.7807691, -73.9012111) },
            { centre_name: "Socceroof Sunset Park", centre_place_id: "ChIJrfgrMK9awokR-Z5O20hCD3w", centre_location: new admin.firestore.GeoPoint(40.6453926, -74.0238801) },
            { centre_name: "Sofive Brooklyn", centre_place_id: "ChIJvytTY_JdwokRVMSxK5pjEyU", centre_location: new admin.firestore.GeoPoint(40.6719131, -73.8984085) },
            { centre_name: "Sofive Meadowlands", centre_place_id: "ChIJNx4uAWf4wokRSocDyrK32sk", centre_location: new admin.firestore.GeoPoint(40.824795, -74.0682588) },
            { centre_name: "Superdome Sports Waldwick", centre_place_id: "ChIJSRmb-4bjwokRX7H7p_nGfn8", centre_location: new admin.firestore.GeoPoint(41.0193689, -74.1299584) },
            { centre_name: "Superdome Sports Fairlawn", centre_place_id: "ChIJb1_Rbhn7wokRPcV_ZAeB8mE", centre_location: new admin.firestore.GeoPoint(41.0201009, -74.2188497) },
            { centre_name: "Soccer Center NYC", centre_place_id: "ChIJ1aOw95RfwokRe0fEYMdtNJg", centre_location: new admin.firestore.GeoPoint(40.729718, -73.967616) },
            { centre_name: "Globall Sports Centers - Brooklyn", centre_place_id: "ChIJYVUE_J9bwokRuEBZfRYfobU", centre_location: new admin.firestore.GeoPoint(40.6928418, -73.9769405) },
            { centre_name: "Brooklyn Force Soccer", centre_place_id: "ChIJ-S82HdRbwokRHcC6tN0__L4", centre_location: new admin.firestore.GeoPoint(40.6794688, -74.0100803) }

        ];

        centreData.forEach((centre) => {
            const docRef = db.collection('cached_centres').doc(centre.centre_place_id);
            batch.set(docRef, centre);
        });

        await batch.commit();
        console.log('Documents successfully written to cached_centres collection.');
    } catch (error) {
        console.error('Error writing documents: ', error);
    }
}

addDocumentsToCachedCentres();
