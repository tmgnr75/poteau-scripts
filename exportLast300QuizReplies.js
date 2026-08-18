const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function exportLatestQuizReplies(limit = 300) {
    console.log(`🚀 Starting export of latest ${limit} quiz replies...`);

    const repliesSnap = await db.collection('quiz_replies')
        .orderBy('created_at', 'desc')
        .where('status', '==', 'complete')
        .limit(limit)
        .get();

    console.log(`📦 Retrieved ${repliesSnap.size} quiz_replies documents.`);

    const output = [];

    let count = 0;
    for (const doc of repliesSnap.docs) {
        const quizReplyId = doc.id;
        const quizReplyData = doc.data();
        count++;
        console.log(`\n==============================`);
        console.log(`📄 Processing #${count} | quiz_reply_id: ${quizReplyId}`);
        console.log(`   Role: ${quizReplyData.role} | Status: ${quizReplyData.status} | Created_at: ${quizReplyData.created_at?.toDate?.()}`);

        // Query quiz_scores for this reply
        const scoresSnap = await db.collection('quiz_scores')
            .where('quiz_reply_id', '==', quizReplyId)
            .limit(1)
            .get();

        if (scoresSnap.empty) {
            console.warn(`   ⚠️ No matching quiz_scores found for reply ${quizReplyId}.`);
            output.push({
                quiz_reply_id: quizReplyId,
                ...quizReplyData,
                model_score: null,
                score_by_skill: null
            });
            continue;
        }

        const scoreDoc = scoresSnap.docs[0];
        const scoreData = scoreDoc.data();

        console.log(`   ✅ Found quiz_scores doc: ${scoreDoc.id}`);
        console.log(`      → Score: ${scoreData.score}`);
        console.log(`      → Score by skill:`, scoreData.score_by_skill);

        // Push merged data
        output.push({
            quiz_reply_id: quizReplyId,
            ...quizReplyData,
            model_score: scoreData.score ?? null,
            score_by_skill: scoreData.score_by_skill ?? null
        });
    }

    // Save to JSON file
    const fileName = `quiz_replies_with_scores.json`;
    fs.writeFileSync(fileName, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\n💾 Export complete! Saved to ${fileName}`);
}

exportLatestQuizReplies(300).catch(err => {
    console.error('❌ Error exporting quiz replies:', err);
});