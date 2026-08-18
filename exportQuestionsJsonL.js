/**
 * EXPORT QUIZ QUESTIONS TO JSONL
 * --------------------------------
 * This script exports the entire `quiz_questions` Firestore collection into a
 * newline-delimited JSON file (JSONL). Each line represents one document.
 *
 * Usage:
 *   node export_quiz_questions.js
 *
 * Output:
 *   ./quiz_questions.jsonl
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const COLLECTION_NAME = 'quiz_questions';
const OUTPUT_PATH = path.join(__dirname, `${COLLECTION_NAME}.jsonl`);

(async () => {
  console.log(`\n[EXPORT][${COLLECTION_NAME}] Starting export process...`);
  console.log(`[EXPORT] Connecting to Firestore project: ${PROJECT_ID}`);
  console.log(`[EXPORT] Output file: ${OUTPUT_PATH}`);

  try {
    const writeStream = fs.createWriteStream(OUTPUT_PATH, { flags: 'w' });
    let count = 0;
    const startTime = Date.now();

    console.log(`[EXPORT] Fetching all documents from collection "${COLLECTION_NAME}"...`);
    const snapshot = await db.collection(COLLECTION_NAME).get();

    if (snapshot.empty) {
      console.warn(`[EXPORT][WARNING] No documents found in collection "${COLLECTION_NAME}".`);
      writeStream.end();
      process.exit(0);
    }

    console.log(`[EXPORT] ${snapshot.size} documents found. Starting write process...`);

    snapshot.forEach((doc) => {
      const data = doc.data();
      data._id = doc.id; // Preserve Firestore document ID
      const jsonLine = JSON.stringify(data);

      writeStream.write(jsonLine + '\n');
      count++;
      if (count % 10 === 0) {
        console.log(`[EXPORT][PROGRESS] ${count}/${snapshot.size} documents exported...`);
      }
    });

    writeStream.end();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[EXPORT][SUCCESS] Export completed.`);
    console.log(`[EXPORT] Total documents exported: ${count}`);
    console.log(`[EXPORT] Time taken: ${duration}s`);
    console.log(`[EXPORT] File saved at: ${OUTPUT_PATH}\n`);
  } catch (error) {
    console.error(`[EXPORT][ERROR] Export failed:`, error);
    process.exit(1);
  }
})();