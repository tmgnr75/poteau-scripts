const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://krank-club.appspot.com/"
});

const bucket = admin.storage().bucket();

async function uploadPoteauImages() {
    const imageFolder = '../Downloads/Poteau 5'; // Path to your images folder

    try {
        // Get the list of PNG files in the directory
        const files = fs.readdirSync(imageFolder).filter(file => file.endsWith('.png'));

        console.log(`Found ${files.length} PNG files to upload\n`);

        // Loop over each file
        for (const file of files) {
            const filePath = path.join(imageFolder, file);

            // Upload the file to Firebase Storage under images/poteau-5/
            const storageFile = bucket.file(`images/${file}`);
            await storageFile.save(fs.readFileSync(filePath));

            // Make the file publicly accessible
            await storageFile.makePublic();

            // Get the public URL of the uploaded file
            const publicUrl = storageFile.publicUrl();

            // Log the URL to the console
            console.log(`✓ ${file}`);
            console.log(`  URL: ${publicUrl}\n`);
        }

        console.log('✅ All Poteau 5 images uploaded successfully!');
    } catch (error) {
        console.error('❌ Error uploading files:', error);
    }
}

// Call the function to execute
uploadPoteauImages();
