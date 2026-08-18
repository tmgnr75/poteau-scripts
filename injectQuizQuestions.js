const admin = require('firebase-admin');
const fs = require('fs');

// === Firebase setup ===
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

console.log("👀 Connected to Firebase project:", admin.app().options.projectId);

const db = admin.firestore();

// === Load translation files ===
const fr = require('./fr.json');
const en = require('./en.json');
const es = require('./es.json');
const it = require('./it.json');

// === Constants ===
const sport = 'soccer';
const version = 1;
const status = 'published';

const emojis = ['😩', '😵‍💫', '😅', '💪', '🦾', '😎'];

// === Group questions and answers ===
const groupedQuestions = {};

function extractFromAllLocales(path) {
  const [sport, role, skill, questionId] = path;
  const q = questionId.replace(/^question/, '');
  const basePath = fr[sport][role][skill][questionId];

  return {
    sport,
    role,
    tested_skill: skill,
    order: parseInt(q),
    question_text: {
      fr: fr[sport][role][skill][questionId].question || '',
      en: en[sport][role][skill][questionId].question || '',
      es: es[sport][role][skill][questionId].question || '',
      it: it[sport][role][skill][questionId].question || '',
    },
    answers: Array.from({ length: 6 }, (_, i) => {
      const key = `answer${i + 1}`;
      return {
        order: i + 1,
        score: 2 + i * 2,
        emoji: emojis[i],
        text: {
          fr: fr[sport][role][skill][questionId][key] || '',
          en: en[sport][role][skill][questionId][key] || '',
          es: es[sport][role][skill][questionId][key] || '',
          it: it[sport][role][skill][questionId][key] || '',
        },
      };
    }),
  };
}

// Traverse the structure
for (const role of Object.keys(fr[sport])) {
  const skills = fr[sport][role];
  for (const skill of Object.keys(skills)) {
    // if (skill !== 'meta') {
    //   console.log(`⏩ Skipping skill '${skill}' for role '${role}' (not meta)`);
    //   continue;
    // }
    const questions = skills[skill];
    for (const questionId of Object.keys(questions)) {
      const docKey = `${sport}.${role}.${skill}.${questionId}`;
      console.log(`➡️ Handling meta skill: ${docKey}`);
      groupedQuestions[docKey] = extractFromAllLocales([sport, role, skill, questionId]);
    }
  }
}

// === Inject documents into Firestore ===
(async () => {
  const collectionRef = db.collection('quiz_questions');

  for (const [key, doc] of Object.entries(groupedQuestions)) {
    // Only inject if the skill is 'meta'
    // if (doc.tested_skill !== 'meta') continue;
    const docData = {
      sport,
      version,
      role: doc.role,
      status,
      tested_skill: doc.tested_skill,
      order: doc.order,
      question_text: doc.question_text,
      answers: doc.answers,
    };

    try {
      await collectionRef.add(docData);
      console.log(`✅ Created: ${key}`);
    } catch (err) {
      console.error(`❌ Failed to create ${key}:`, err);
    }
  }

  console.log('🎉 All quiz questions uploaded successfully!');
})();