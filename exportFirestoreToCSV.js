const admin = require('firebase-admin');
const fs = require('fs');
const { Parser } = require('json2csv');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function exportQuizQuestions() {
    console.log('🔁 Starting export of quiz_questions collection from Firebase...');

    const snapshot = await db.collection('quiz_questions').get();

    if (snapshot.empty) {
        console.log('⚠️ No documents found in quiz_questions.');
        return;
    }

    console.log(`📦 Found ${snapshot.size} documents. Processing...\n`);

    const output = [];

    for (const doc of snapshot.docs) {
        const data = doc.data();
        console.log(`📄 Exporting document ID: ${doc.id}`);

        const baseFields = {
            firebase_id: doc.id,
            role: data.role || '',
            sport: data.sport || '',
            status: data.status || '',
            tested_skill: data.tested_skill || '',
            version: data.version ?? '',
        };

        const questionText = {
            question_en: data.question_text?.en || '',
            question_fr: data.question_text?.fr || '',
            question_es: data.question_text?.es || '',
            question_it: data.question_text?.it || '',
        };

        const flatAnswers = (data.answers || []).map((a, i) => ({
            [`answer_${i + 1}_emoji`]: a.emoji || '',
            [`answer_${i + 1}_score`]: a.score ?? '',
            [`answer_${i + 1}_order`]: a.order ?? '',
            [`answer_${i + 1}_text_en`]: a.text?.en || '',
            [`answer_${i + 1}_text_fr`]: a.text?.fr || '',
            [`answer_${i + 1}_text_es`]: a.text?.es || '',
            [`answer_${i + 1}_text_it`]: a.text?.it || '',
        }));

        const mergedAnswers = Object.assign({}, ...flatAnswers);

        output.push({
            ...baseFields,
            ...questionText,
            ...mergedAnswers,
        });

        console.log(`✅ Exported: ${doc.id} (${data.question_text?.en || 'No title'})`);
    }

    // Export CSV
    const csv = new Parser().parse(output);
    fs.writeFileSync('quiz_questions_export.csv', csv);
    console.log('\n📄 CSV export complete: quiz_questions_export.csv');

    // Export JSON
    fs.writeFileSync('quiz_questions_export.json', JSON.stringify(output, null, 2));
    console.log('📄 JSON export complete: quiz_questions_export.json');

    console.log('\n🎉 Export finished successfully!');
}

exportQuizQuestions().catch((err) => {
    console.error('❌ Export failed:', err);
});