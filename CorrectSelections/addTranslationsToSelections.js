const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Helper function to update documents in Firestore
async function updateFirestoreTranslations(fileName, language) {
    const filePath = `./${fileName}`;
    const translations = require(filePath);

    const promises = Object.entries(translations).map(async ([id, name]) => {
        try {
            const docRef = db.collection('selections').doc(id);
            await docRef.update({
                [`name_${language}`]: name,
            });
            console.log(`Updated document with ID: ${id} for language: ${language}`);
        } catch (error) {
            console.error(`Error updating document with ID: ${id} for language: ${language}`, error);
        }
    });

    await Promise.all(promises);
}

// Function to update all translations
async function updateAllTranslations() {
    try {
        // Update 'en', 'es', and 'it' translations
        await updateFirestoreTranslations('en.json', 'en');
        await updateFirestoreTranslations('es.json', 'es');
        await updateFirestoreTranslations('it.json', 'it');

        console.log('All translations have been updated in Firestore!');
    } catch (error) {
        console.error('Error updating translations:', error);
    }
}

// Start the update process
updateAllTranslations();