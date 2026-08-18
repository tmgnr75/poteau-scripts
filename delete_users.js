const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateAndDeleteFields(userIds) {
    try {
        const batch = db.batch();

        for (const userId of userIds) {
            const userRef = db.collection('users').doc(userId);

            // Check if the document exists
            const userSnapshot = await userRef.get();

            if (userSnapshot.exists) {
                // Update fields
                batch.update(userRef, {
                    first_name: 'Compte',
                    last_name: 'supprimé',
                    display_name: 'Compte supprimé',
                    gold_status: false,
                    auth_email: false,
                    hash_pic: 'KCMtaOof0000ay_3xufQ~q',
                    photo_url: 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fdefault-profile-picture-grey.png?alt=media&token=3a18c8fc-e426-442b-87eb-8888a08ec863',
                });

                // Delete fields
                batch.update(userRef, {
                    phone_number: admin.firestore.FieldValue.delete(),
                    email: admin.firestore.FieldValue.delete(),
                    last_location: admin.firestore.FieldValue.delete(),
                    last_address: admin.firestore.FieldValue.delete(),
                });

                console.log(`Updated and deleted fields for user with ID: ${userId}`);
            } else {
                console.log(`User with ID ${userId} does not exist. Skipping.`);
            }
        }

        // Commit the batch update
        await batch.commit();
    } catch (error) {
        console.error('Error updating and deleting fields:', error);
    }
}


const userIDsToUpdate = [
    'T9X4NBzC9bUiVbzX04jAx9tZI4N2',
    'io7cKjWMgOV2n2X6af7u4AzIHBF2',
    'toCmCCbRPjRqDBYO1oNTuyhQY7Y2',
    '7FvVe0UBSJQP7U4Busd01uTxGXA3'
];

updateAndDeleteFields(userIDsToUpdate);