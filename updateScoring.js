const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

(async () => {
    console.log('🔥 Starting score normalization for quiz_questions…');

    try {
        const snapshot = await db.collection('quiz_questions').get();
        console.log(`📦 Found ${snapshot.size} documents in quiz_questions.`);

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const answers = data.answers; // <-- the mapped array field
            let changed = false;

            if (!answers || typeof answers !== 'object') {
                console.log(`⚠️ Document [${doc.id}] has no answers field or unexpected structure.`);
                continue;
            }

            console.log(`\n➡️ Processing doc [${doc.id}] with tested_skill: ${data.tested_skill}, role: ${data.role}`);

            // answers is often stored as an array of maps
            let newAnswers = Array.isArray(answers) ? [...answers] : Object.assign({}, answers);

            if (Array.isArray(newAnswers)) {
                newAnswers = newAnswers.map((item, index) => {
                    if (item && typeof item === 'object' && typeof item.order === 'number') {
                        const expectedScore = (item.order - 1) * 2;
                        if (item.score !== expectedScore) {
                            console.log(`   ✏️ Updating item with order ${item.order} (emoji: ${item.emoji}) from score ${item.score} → ${expectedScore}`);
                            changed = true;
                            return { ...item, score: expectedScore };
                        } else {
                            console.log(`   ✅ Item with order ${item.order} already correct (score: ${item.score})`);
                            return item;
                        }
                    } else {
                        console.log(`   ⚠️ Skipping non-standard item at index ${index}`);
                        return item;
                    }
                });
            } else {
                // If it's a map with numeric keys
                for (const key of Object.keys(newAnswers)) {
                    const item = newAnswers[key];
                    if (item && typeof item === 'object' && typeof item.order === 'number') {
                        const expectedScore = (item.order - 1) * 2;
                        if (item.score !== expectedScore) {
                            console.log(`   ✏️ Updating item ${key} (order ${item.order}) from score ${item.score} → ${expectedScore}`);
                            changed = true;
                            newAnswers[key] = { ...item, score: expectedScore };
                        } else {
                            console.log(`   ✅ Item ${key} (order ${item.order}) already correct (score: ${item.score})`);
                        }
                    }
                }
            }

            if (changed) {
                await db.collection('quiz_questions').doc(doc.id).update({ answers: newAnswers });
                console.log(`✅ Document [${doc.id}] updated successfully.`);
            } else {
                console.log(`ℹ️ No updates needed for document [${doc.id}].`);
            }
        }

        console.log('\n🎉 All quiz_questions processed.');
    } catch (err) {
        console.error('❌ Error during score normalization:', err);
    }
})();