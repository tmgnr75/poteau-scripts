const admin = require('firebase-admin');
const fs = require('fs');

// === Firebase Init ===
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// === Load input JSON ===
const updates = JSON.parse(fs.readFileSync('./skill1stImprovements.json', 'utf8'));

// === Helper ===
function parseKey(key) {
  const answerMatch = key.match(/^answer_(\d+)_text_(\w{2})$/);
  const questionMatch = key.match(/^question_(\w{2})$/);

  if (answerMatch) {
    return {
      type: 'answer',
      answerIndex: parseInt(answerMatch[1]) - 1,
      lang: answerMatch[2],
    };
  } else if (questionMatch) {
    return {
      type: 'question',
      lang: questionMatch[1],
    };
  }
  return null;
}

// === Main Update Logic ===
(async () => {
  console.log(`🚀 Starting updates for ${updates.length} entries...\n`);

  for (const [i, change] of updates.entries()) {
    const { firebase_id, key, previous_value, new_value } = change;
    const ref = db.collection('quiz_questions').doc(firebase_id);
    const parsed = parseKey(key);

    console.log(`🔍 [${i + 1}/${updates.length}] Updating ${firebase_id} > ${key}`);
    if (!parsed) {
      console.warn(`⚠️  Skipping unsupported key format: ${key}`);
      continue;
    }

    try {
      const docSnap = await ref.get();
      if (!docSnap.exists) {
        console.error(`❌ Document not found: ${firebase_id}`);
        continue;
      }

      const data = docSnap.data();

      if (parsed.type === 'question') {
        const current = data.question_text?.[parsed.lang];
        if (current !== previous_value) {
          console.warn(`⚠️  Mismatch on question.${parsed.lang} — found: "${current}"`);
        }

        await ref.update({
          [`question_text.${parsed.lang}`]: new_value,
        });

        console.log(`✅ question_text.${parsed.lang} updated to "${new_value}"`);

      } else if (parsed.type === 'answer') {
        const answer = data.answers?.[parsed.answerIndex];
        if (!answer) {
          console.error(`❌ No answer at index ${parsed.answerIndex} in doc ${firebase_id}`);
          continue;
        }

        const current = answer.text?.[parsed.lang];
        if (current !== previous_value) {
          console.warn(`⚠️  Mismatch on answers[${parsed.answerIndex}].text.${parsed.lang} — found: "${current}"`);
        }

        answer.text[parsed.lang] = new_value;

        await ref.update({
          answers: data.answers,
        });

        console.log(`✅ answers[${parsed.answerIndex}].text.${parsed.lang} updated to "${new_value}"`);
      }

    } catch (err) {
      console.error(`❌ Error updating ${firebase_id}:`, err);
    }

    console.log('---');
  }

  console.log('🎉 All updates complete.');
})();