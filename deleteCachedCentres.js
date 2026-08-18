const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function deleteCachedCentres() {
    try {
        const batch = db.batch();

        const docsToDelete = [
            'ChIJfdfQY1zVwkcR1O6q90ikxpw',
            'ChIJQeoTKuU50i0RJen2BmD4P0A',
            'ChIJHaQHO2w50i0RUuRR6_z-g7k',
            'ChIJW9gFDoErzBIR_l4v9GDRk4c',
            'ChIJVVVhhb4Il0cR3vyfsSU6jgk',
            'ChIJgeGNmZu_w0cRs_46ZQ4p_j0',
            'ChIJiYDWX07r9EcRJxDR20fi4JI',
            'ChIJ8dBpRb1NtRIRgNtRIAChe9Y',
            'ChIJnec1R4MB50cRbJyfrX6q6c0',
            'ChIJq_gvh8jVwkcRcW8Y31z_Lr8',
            'ChIJVS3tALtl5kcRXV36tExi2fU',
            'ChIJfa9YJgBt5kcRB2RMV-iS3hg'
        ];

        docsToDelete.forEach((docId) => {
            const docRef = db.collection('cached_centres').doc(docId);
            batch.delete(docRef);
            console.log(`Prepared to delete: ${docId}`);
        });

        await batch.commit();
        console.log(`\nSuccessfully deleted ${docsToDelete.length} documents!`);
    } catch (error) {
        console.error('Error deleting documents:', error);
    }
    process.exit(0);
}

deleteCachedCentres();
