const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function addCachedCentres() {
    try {
        const batch = db.batch();

        const centres = [
            {
                centre_name: '4PADEL Argenteuil',
                centre_place_id: 'ChIJ33T-c5pn5kcR9aJNxp19dtY',
                centre_location: new admin.firestore.GeoPoint(48.949798, 2.2103022),
                centre_image: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2F567420366_17842042581602643_8867725249913169582_n.jpg?alt=media&token=607750e7-ced4-4536-9ec1-bf4b3860b075',
                priority: 1,
                sports: ['padel']
            },
            {
                centre_name: 'LE FIVE Colombes',
                centre_place_id: 'ChIJtW2wgSxl5kcRW1N56-y8ETo',
                centre_location: new admin.firestore.GeoPoint(48.9272376, 2.2144731),
                centre_image: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/users%2FIzKPWsB4aacK86ccCoYIsIi4bEH3%2Fuploads%2F1693830530094545.jpg?alt=media&token=1a589027-025a-41c6-ad5b-202bb26cf92c',
                priority: 1,
                sports: ['soccer']
            }
        ];

        centres.forEach((centre) => {
            const docRef = db.collection('cached_centres').doc(centre.centre_place_id);
            batch.set(docRef, centre);
            console.log(`Prepared: ${centre.centre_name}`);
        });

        await batch.commit();
        console.log('\nSuccessfully added all centres!');
    } catch (error) {
        console.error('Error adding centres:', error);
    }
    process.exit(0);
}

addCachedCentres();
