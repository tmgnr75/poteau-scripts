const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://krank-club.appspot.com/"
});

const bucket = admin.storage().bucket();

async function uploadImagesAndLogURLs() {
    const imageFolder = '../Downloads/favorite-clubs-logo'; // Path to your images folder

    try {
        // Get the list of PNG files in the directory
        const files = fs.readdirSync(imageFolder).filter(file => file.endsWith('.png'));

        // Loop over each file
        for (const file of files) {
            const filePath = path.join(imageFolder, file);

            // Upload the file to Firebase Storage
            const storageFile = bucket.file(`clubs/${file}`);
            await storageFile.save(fs.readFileSync(filePath));

            // Make the file publicly accessible
            await storageFile.makePublic();

            // Get the public URL of the uploaded file
            const publicUrl = storageFile.publicUrl();

            // Log the URL to the console
            console.log(`Uploaded and accessible at: ${publicUrl}`);
        }

        console.log('All files uploaded successfully.');
    } catch (error) {
        console.error('Error uploading files:', error);
    }
}

// Call the function to execute
uploadImagesAndLogURLs();