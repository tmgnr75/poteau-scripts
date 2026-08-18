const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

// Get a reference to the Firebase Storage service
const storage = admin.storage();
const bucketName = 'krank-club.appspot.com'; // Replace this with your bucket name
const bucket = storage.bucket(bucketName);

// Get a reference to the Firestore database
const db = admin.firestore();

// Path to the local folder containing PNG files
const localFolderPath = './png_files';

// Function to upload PNG files to Firebase Storage
async function uploadFilesToStorage() {
    try {
        // Read the list of files in the local folder
        const files = fs.readdirSync(localFolderPath);

        // Iterate through each file
        for (const file of files) {
            // Extract country code from the file name
            const countryCode = file.substring(0, 2);

            // Construct the path to upload the file to Firebase Storage
            const storageFilePath = `selection-flags/${file}`;

            // Upload the file to Firebase Storage
            await bucket.upload(`${localFolderPath}/${file}`, {
                destination: storageFilePath,
            });

            console.log(`File ${file} uploaded to Firebase Storage`);

            // Get the public URL of the uploaded file
            const [url] = await bucket.file(storageFilePath).getSignedUrl({
                action: 'read',
                expires: '01-01-2100', // Set a far future expiration date
            });

            console.log(`URL for ${file}: ${url}`);

            // Update Firestore document with the URL
            const snapshot = await db.collection('selections').where('country_code', '==', countryCode).get();
            snapshot.forEach(async (doc) => {
                await doc.ref.update({ url });
                console.log(`Document updated with URL for country code ${countryCode}`);
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Call the function to upload files
uploadFilesToStorage();
