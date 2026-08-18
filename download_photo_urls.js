const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');
const https = require('https');
const { URL } = require('url');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();
const usersCollection = db.collection('users');

const downloadImage = async (url, fileName) => {
    const writer = fs.createWriteStream(fileName);
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            response.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    });
};

const fetchAndDownloadImages = async () => {
    try {
        const snapshot = await usersCollection.limit(50).offset(7500).get();
        const documents = snapshot.docs.map(doc => doc.data());

        for (const doc of documents) {
            const { photo_url } = doc;
            if (photo_url && !isExcludedUrl(photo_url)) {
                const imageUrl = new URL(photo_url);
                const fileExtension = imageUrl.pathname.substring(imageUrl.pathname.lastIndexOf('.'));
                const fileName = `downloaded_${Date.now()}${fileExtension}`;
                await downloadImage(photo_url, fileName);
                console.log(`Downloaded image: ${fileName}`);
            }
        }
        console.log('Image download completed.');
    } catch (error) {
        console.error('Error downloading images:', error);
    }
};

const isExcludedUrl = (url) => {
    const excludedUrls = [
        "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fben-poteau-small.png?alt=media&token=7bcdd130-a529-4d37-8e67-75048fd07a0e",
        "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fdefault-profile-picture-grey.png?alt=media&token=3a18c8fc-e426-442b-87eb-8888a08ec863"
    ];
    return excludedUrls.includes(url);
};

fetchAndDownloadImages();
