const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const improvementsPath = path.join(__dirname, 'improvements_2.json');
const improvements = JSON.parse(fs.readFileSync(improvementsPath, 'utf8'));

// readline interface for user confirmation
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer));
    });
}

(async () => {
    console.log(`🔍 Starting update for ${improvements.length} improvements...`);

    for (const [index, item] of improvements.entries()) {
        const { firebase_id, field, new: newValue } = item;
        const parts = field.split('_');

        console.log(`\n📄 [${index + 1}/${improvements.length}] Processing doc ID: ${firebase_id}`);
        console.log(`   ➡ Field: ${field}`);

        const docRef = db.collection('quiz_questions').doc(firebase_id);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            console.warn(`   ⚠ Document ${firebase_id} not found. Skipping.`);
            continue;
        }

        const data = docSnap.data();
        let currentValue;

        if (parts.length === 2 && parts[0] === 'question') {
            const lang = parts[1];
            currentValue = data?.question_text?.[lang] || '';
            console.log(`   📝 Current value: "${currentValue}"`);
            console.log(`   🆕 New value:     "${newValue}"`);

            const answer = await ask("   ❓ Press SPACE to update, any other key to skip: ");
            if (answer.trim() === '') {
                await docRef.update({ [`question_text.${lang}`]: newValue });
                console.log(`   ✅ Updated question_text.${lang}`);
            } else {
                console.log(`   ⏭ Skipped.`);
            }

        } else if (parts.length === 4 && parts[0] === 'answer' && parts[2] === 'text') {
            const order = parseInt(parts[1], 10);
            const lang = parts[3];

            const answers = data.answers || [];
            const answerIndex = answers.findIndex(a => a.order === order);

            if (answerIndex === -1) {
                console.warn(`   ⚠ No answer with order ${order} found. Skipping.`);
                continue;
            }

            currentValue = answers[answerIndex]?.text?.[lang] || '';
            console.log(`   📝 Current value: "${currentValue}"`);
            console.log(`   🆕 New value:     "${newValue}"`);

            const answer = await ask("   ❓ Press SPACE to update, any other key to skip: ");
            if (answer.trim() === '') {
                answers[answerIndex].text[lang] = newValue;
                await docRef.update({ answers });
                console.log(`   ✅ Updated answers[${answerIndex}].text.${lang}`);
            } else {
                console.log(`   ⏭ Skipped.`);
            }

        } else {
            console.warn(`   ⚠ Unknown field format: ${field}. Skipping.`);
        }
    }

    rl.close();
    console.log(`\n🎯 All updates processed.`);
    process.exit(0);
})();