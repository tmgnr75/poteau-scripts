const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const quizScoresCollection = 'quiz_scores';
const docIdsToDelete = [
    '6wUwgXS2OCFT9rSEqY5W',
    'G3InfhYpGKmDI8c2MVv2',
    'MPWssWzCb7D9XVqs7Ugf',
    'X1EYaQs1jt9d4fpSa033',
    'jZ6jGlFeF3rNWoh4fGDm',
    'kt67uDBWGF65vp5PbnSi',
    'rbgLTzwvc03d2d3iXTyE',
];

async function deleteQuizScores() {
    console.log('🗑️ Starting deletion of quiz_scores documents...');
    console.log(`📋 Total documents to delete: ${docIdsToDelete.length}\n`);

    for (const docId of docIdsToDelete) {
        const docRef = db.collection(quizScoresCollection).doc(docId);

        try {
            const snapshot = await docRef.get();

            if (!snapshot.exists) {
                console.log(`⚠️ Document with ID '${docId}' does not exist. Skipping.`);
                continue;
            }

            await docRef.delete();
            console.log(`✅ Successfully deleted document: ${docId}`);
        } catch (error) {
            console.error(`❌ Failed to delete document '${docId}':`, error);
        }
    }

    console.log('\n✅ Deletion process completed.');
}

deleteQuizScores()
    .catch((err) => {
        console.error('🔥 Unexpected error during deletion process:', err);
    });