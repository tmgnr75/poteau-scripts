const admin = require('firebase-admin');
const fs = require('fs');
const QRCode = require('qrcode');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://krank-club.appspot.com/"
});

const db = admin.firestore();

async function generateQRCode(user) {
    try {
        console.log(`Generating QR code for ${user.short_name}...`);

        const url = `https://poteau.app/centre/${user.short_name}`;
        const qrCodeFileName = `posters/${user.short_name}_qr_code.png`;

        console.log(`QR code URL: ${url}`);
        console.log(`QR code file name: ${qrCodeFileName}`);

        // Generate QR Code
        const qrCodeBuffer = await QRCode.toFile(qrCodeFileName, url, {
            type: 'png',
            errorCorrectionLevel: 'H'
        });

        console.log(`QR code generated successfully for ${user.short_name}`);

        // Upload QR Code to Firebase Storage
        console.log(`Uploading QR code to Firebase Storage...`);
        const storage = admin.storage().bucket();
        await storage.upload(qrCodeFileName, {
            destination: qrCodeFileName
        });

        console.log(`QR code uploaded successfully to Firebase Storage`);

        // Get signed URL for the uploaded QR Code
        console.log(`Getting signed URL for the QR code...`);
        const [signedUrl] = await storage.file(qrCodeFileName).getSignedUrl({
            action: 'read',
            expires: '01-01-2500' // Adjust the expiration date if needed
        });

        console.log(`Signed URL for the QR code: ${signedUrl}`);

        // Update user document with QR code URL
        console.log(`Updating user document with QR code URL...`);
        await db.collection('users').doc(user.id).update({
            qr_code: signedUrl
        });

        console.log(`User document updated successfully with QR code URL for ${user.short_name}`);
    } catch (error) {
        console.error(`Error generating QR code for ${user.short_name}:`, error);
    }
}

async function fetchUsers() {
    try {
        console.log(`Fetching users where type is 'pro'...`);

        const usersSnapshot = await db.collection('users').where('type', '==', 'pro').get();

        if (usersSnapshot.empty) {
            console.log('No users found where type is "pro".');
            return;
        }

        console.log(`Found ${usersSnapshot.size} users where type is 'pro'.`);

        const users = [];
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            user.id = doc.id;
            users.push(user);
        });

        console.log('Checking QR codes for users...');

        // Check QR code for each user
        for (const user of users) {
            // if (!user.qr_code) {
                await generateQRCode(user);
            // } else {
                // console.log(`QR code already exists for ${user.short_name}. Skipping.`);
            // }
        }

        console.log('All QR codes checked.');
    } catch (error) {
        console.error('Error fetching users:', error);
    }
}

const postersDir = './posters';

// Check if posters directory exists, if not create it
if (!fs.existsSync(postersDir)) {
    fs.mkdirSync(postersDir);
}

// Now you can run your fetchUsers function
fetchUsers();
