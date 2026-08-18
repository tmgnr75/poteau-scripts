const admin = require('firebase-admin');
const fs = require('fs');
const readline = require('readline');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Configuration
const JSONL_FILE_PATH = './padel_quiz_questions.jsonl';
const COLLECTION_NAME = 'quiz_questions';
const BATCH_SIZE = 500; // Firestore batch limit

// Statistics
let stats = {
    totalLines: 0,
    successfulImports: 0,
    failedImports: 0,
    skippedLines: 0,
    startTime: Date.now(),
};

console.log('🚀 Starting Padel Quiz Import Script');
console.log('=====================================');
console.log(`📁 Source file: ${JSONL_FILE_PATH}`);
console.log(`🗄️  Target collection: ${COLLECTION_NAME}`);
console.log(`📦 Batch size: ${BATCH_SIZE}`);
console.log('');

/**
 * Validates a quiz question document
 */
function validateQuizQuestion(doc, lineNumber) {
    const required = ['sport', 'version', 'status', 'tested_skill', 'order', 'question_text', 'answers'];
    const missing = required.filter(field => !(field in doc));

    if (missing.length > 0) {
        console.warn(`⚠️  Line ${lineNumber}: Missing required fields: ${missing.join(', ')}`);
        return false;
    }

    if (doc.sport !== 'padel') {
        console.warn(`⚠️  Line ${lineNumber}: Sport is "${doc.sport}", expected "padel"`);
        return false;
    }

    if (!Array.isArray(doc.answers) || doc.answers.length !== 6) {
        console.warn(`⚠️  Line ${lineNumber}: Expected 6 answers, got ${doc.answers?.length || 0}`);
        return false;
    }

    // Validate each answer has required fields
    for (let i = 0; i < doc.answers.length; i++) {
        const answer = doc.answers[i];
        if (!answer.order || !answer.score || !answer.emoji || !answer.text) {
            console.warn(`⚠️  Line ${lineNumber}: Answer ${i + 1} missing required fields`);
            return false;
        }

        // Check that all 4 languages are present in question_text and answer text
        const languages = ['fr', 'en', 'es', 'it'];
        const missingLangs = languages.filter(lang => !(lang in answer.text));
        if (missingLangs.length > 0) {
            console.warn(`⚠️  Line ${lineNumber}: Answer ${i + 1} missing languages: ${missingLangs.join(', ')}`);
            return false;
        }
    }

    // Check question_text has all languages
    const languages = ['fr', 'en', 'es', 'it'];
    const missingLangs = languages.filter(lang => !(lang in doc.question_text));
    if (missingLangs.length > 0) {
        console.warn(`⚠️  Line ${lineNumber}: Question text missing languages: ${missingLangs.join(', ')}`);
        return false;
    }

    return true;
}

/**
 * Imports a batch of documents to Firestore
 */
async function importBatch(documents) {
    const batch = db.batch();

    documents.forEach(doc => {
        // Use auto-generated document ID
        const docRef = db.collection(COLLECTION_NAME).doc();
        batch.set(docRef, doc);

        console.log(`   📝 Setting document (order: ${doc.order}, skill: ${doc.tested_skill})`);
    });

    try {
        await batch.commit();
        console.log(`✅ Batch committed: ${documents.length} documents`);
        return { success: documents.length, failed: 0 };
    } catch (error) {
        console.error(`❌ Batch commit failed:`, error.message);
        return { success: 0, failed: documents.length };
    }
}

/**
 * Main import function
 */
async function importQuizQuestions() {
    console.log('📖 Reading JSONL file...\n');

    // Check if file exists
    if (!fs.existsSync(JSONL_FILE_PATH)) {
        console.error(`❌ File not found: ${JSONL_FILE_PATH}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(JSONL_FILE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineNumber = 0;
    let currentBatch = [];
    const allDocuments = [];

    // Process each line
    for await (const line of rl) {
        lineNumber++;
        stats.totalLines++;

        // Skip empty lines
        if (!line.trim()) {
            console.log(`⏭️  Line ${lineNumber}: Empty line, skipping`);
            stats.skippedLines++;
            continue;
        }

        try {
            // Parse JSON
            const doc = JSON.parse(line);
            console.log(`\n📝 Line ${lineNumber}: Parsing question (order: ${doc.order}, skill: ${doc.tested_skill})`);

            // Validate
            if (!validateQuizQuestion(doc, lineNumber)) {
                stats.failedImports++;
                continue;
            }

            console.log(`   ✓ Validation passed`);
            console.log(`   ✓ FR: "${doc.question_text.fr}"`);
            console.log(`   ✓ EN: "${doc.question_text.en}"`);

            allDocuments.push(doc);
            currentBatch.push(doc);

            // If batch is full, import it
            if (currentBatch.length >= BATCH_SIZE) {
                console.log(`\n📦 Batch full (${BATCH_SIZE} documents), committing...`);
                const result = await importBatch(currentBatch);
                stats.successfulImports += result.success;
                stats.failedImports += result.failed;
                currentBatch = [];
            }

        } catch (error) {
            console.error(`❌ Line ${lineNumber}: Parse error - ${error.message}`);
            stats.failedImports++;
        }
    }

    // Import remaining documents
    if (currentBatch.length > 0) {
        console.log(`\n📦 Importing final batch (${currentBatch.length} documents)...`);
        const result = await importBatch(currentBatch);
        stats.successfulImports += result.success;
        stats.failedImports += result.failed;
    }

    // Print summary
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    console.log('\n');
    console.log('=====================================');
    console.log('📊 Import Complete!');
    console.log('=====================================');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📄 Total lines processed: ${stats.totalLines}`);
    console.log(`✅ Successful imports: ${stats.successfulImports}`);
    console.log(`❌ Failed imports: ${stats.failedImports}`);
    console.log(`⏭️  Skipped lines: ${stats.skippedLines}`);
    console.log('');

    // Show breakdown by skill
    if (allDocuments.length > 0) {
        console.log('📈 Breakdown by skill:');
        const skillCounts = {};
        allDocuments.forEach(doc => {
            skillCounts[doc.tested_skill] = (skillCounts[doc.tested_skill] || 0) + 1;
        });
        Object.entries(skillCounts).forEach(([skill, count]) => {
            console.log(`   ${skill}: ${count} questions`);
        });
        console.log('');
    }

    // Verify in Firestore
    console.log('🔍 Verifying import in Firestore...');
    try {
        const snapshot = await db.collection(COLLECTION_NAME)
            .where('sport', '==', 'padel')
            .get();
        console.log(`✅ Found ${snapshot.size} padel questions in Firestore`);

        if (snapshot.size !== stats.successfulImports) {
            console.warn(`⚠️  Warning: Expected ${stats.successfulImports} but found ${snapshot.size}`);
        }
    } catch (error) {
        console.error(`❌ Verification failed:`, error.message);
    }

    console.log('');
    console.log('🎉 All done!');
}

// Run the import
importQuizQuestions()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
