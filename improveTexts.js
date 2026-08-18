const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();
const improvements = JSON.parse(fs.readFileSync('./improvements.json', 'utf8'));

(async () => {
    console.log(`🚀 Starting improvement sync for ${improvements.length} items...\n`);

    for (const { firebase_id, field, old, new: newValue } of improvements) {
        const docRef = db.collection('quiz_questions').doc(firebase_id);

        try {
            const docSnap = await docRef.get();
            if (!docSnap.exists) {
                console.warn(`⚠️ Document not found: ${firebase_id}`);
                continue;
            }

            const data = docSnap.data();
            const updateData = {};

            // Handle question_text.{lang}
            if (field.startsWith('question_')) {
                const lang = field.split('_')[1];
                const current = data.question_text?.[lang];

                if (current !== old) {
                    console.warn(`🟡 Skipped [${firebase_id}] question_text.${lang}: old value mismatch\n   Expected: "${old}"\n   Found:    "${current}"`);
                    continue;
                }

                updateData[`question_text.${lang}`] = newValue;
                console.log(`✅ Will update question_text.${lang} in [${firebase_id}]\n   Old: "${old}"\n   New: "${newValue}"`);
            }

            // Handle answers[n].text.{lang}
            else if (field.startsWith('answer_')) {
                const lang = field.split('_')[3];
                const answers = data.answers || [];
                let found = false;

                for (let i = 0; i < answers.length; i++) {
                    const text = answers[i]?.text?.[lang];
                    if (text === old) {
                        updateData[`answers.${i}.text.${lang}`] = newValue;
                        console.log(`✅ Will update answers[${i}].text.${lang} in [${firebase_id}]\n   Old: "${old}"\n   New: "${newValue}"`);
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    console.warn(`🟡 Skipped [${firebase_id}] answer_text.${lang}: no answer matched old value:\n   "${old}"`);
                    continue;
                }
            }

            // Apply update
            if (Object.keys(updateData).length > 0) {
                await docRef.update(updateData);
            }

        } catch (err) {
            console.error(`❌ Error in [${firebase_id}] for field ${field}: ${err.message}`);
        }
    }

    console.log('\n🎯 Sync completed.');
})();