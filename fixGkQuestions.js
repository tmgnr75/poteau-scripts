const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function updateTestedSkill(oldValue, newValue) {
    console.log(`\n🔍 Searching for quiz_questions with role=goalkeeper and tested_skill="${oldValue}"`);

    const snapshot = await db.collection('quiz_questions')
        .where('role', '==', 'goalkeeper')
        .where('tested_skill', '==', oldValue)
        .get();

    if (snapshot.empty) {
        console.log(`⚠️ No documents found for tested_skill "${oldValue}"`);
        return;
    }

    console.log(`📦 Found ${snapshot.size} documents to update from "${oldValue}" → "${newValue}"`);

    for (const doc of snapshot.docs) {
        const docRef = doc.ref;
        console.log(`  ✏️ Updating ${doc.id}: ${oldValue} → ${newValue}`);
        await docRef.update({ tested_skill: newValue });
    }

    console.log(`✅ Completed updates for tested_skill "${oldValue}"`);
}

async function main() {
    await updateTestedSkill("1-on-1", "one_on_one");
    await updateTestedSkill("shot-stopping", "shot_stopping");
}

main().catch(console.error);