const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const skillMap = {
    shot_stopping: ["q3", "q4"],
    one_on_one: ["q5", "q6"],
};

function determineSkill(questionId) {
    if (skillMap.shot_stopping.includes(questionId)) return "shot_stopping";
    if (skillMap.one_on_one.includes(questionId)) return "one_on_one";
    return null;
}

async function main() {
    console.log("⏳ Fetching quiz_replies for role == goalkeeper && status == complete…");
    const snapshot = await db.collection('quiz_replies')
        .where('role', '==', 'goalkeeper')
        .where('status', '==', 'complete')
        .get();

    console.log(`📦 Found ${snapshot.size} quiz_replies to process\n`);
    let updatedCount = 0;

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const originalAnswers = data.answers;

        if (!Array.isArray(originalAnswers)) continue;

        let changed = false;

        const updatedAnswers = originalAnswers.map((answer) => {
            const expectedSkill = determineSkill(answer.question);
            if (!expectedSkill || answer.tested_skill) return answer;

            changed = true;
            console.log(`✅ ${doc.id}: setting tested_skill="${expectedSkill}" for question="${answer.question}"`);
            return { ...answer, tested_skill: expectedSkill };
        });

        if (changed) {
            await doc.ref.update({ answers: updatedAnswers });
            updatedCount++;
        }
    }

    console.log(`\n✅ Done. ${updatedCount} documents were updated.`);
}

main().catch(console.error);