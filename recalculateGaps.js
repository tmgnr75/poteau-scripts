const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

function roundGap(gap) {
    return Math.round(gap * 10) / 10;
}

function updateDistribution(distribution, gap) {
    const key = roundGap(gap).toFixed(1);
    distribution[key] = (distribution[key] || 0) + 1;
}

(async () => {
    console.log(`🚀 Starting full gap recalculation`);
    console.log(`📘 Collection: quiz_scores`);
    console.log(`🕐 Timestamp: ${new Date().toISOString()}\n`);

    const beforeDistribution = {};
    const afterDistribution = {};
    let updatedCount = 0;
    let totalCount = 0;

    const snapshot = await db.collection('quiz_scores').get();
    console.log(`📥 Total documents retrieved: ${snapshot.size}\n`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        const docId = doc.id;
        const { score, self_score, gap } = data;

        // Skip if score or self_score are not valid numbers
        if (typeof score !== "number" || typeof self_score !== "number") {
            console.log(`⚠️ [${docId}] Missing or invalid score/self_score – skipping.`);
            continue;
        }

        const currentGap = typeof gap === "number" ? roundGap(gap) : null;
        const recalculatedGap = roundGap(score - self_score);

        // Track for stats
        if (currentGap !== null) updateDistribution(beforeDistribution, currentGap);
        updateDistribution(afterDistribution, recalculatedGap);

        if (currentGap === recalculatedGap) {
            console.log(`⏩ [${docId}] Gap unchanged (${recalculatedGap}) – skipping.`);
            continue;
        }

        console.log(`🔄 [${docId}] Updating gap: ${currentGap} → ${recalculatedGap}`);

        await doc.ref.update({ gap: recalculatedGap });
        updatedCount++;
        totalCount++;
    }

    console.log(`\n✅ Gap recalculation completed.`);
    console.log(`🧮 Documents processed: ${totalCount}`);
    console.log(`✏️ Gaps updated: ${updatedCount}\n`);

    // Merge and sort all gap keys
    const allKeys = new Set([
        ...Object.keys(beforeDistribution),
        ...Object.keys(afterDistribution),
    ]);
    const numericKeys = Array.from(allKeys)
        .map(parseFloat)
        .sort((a, b) => a - b);

    const min = Math.floor(numericKeys[0] * 10) / 10;
    const max = Math.ceil(numericKeys[numericKeys.length - 1] * 10) / 10;

    function printDistribution(title, dist) {
        console.log(`📊 ${title}`);
        for (let val = min; val <= max + 0.001; val += 0.1) {
            const key = val.toFixed(1);
            const count = dist[key] || 0;
            console.log(`${key.padStart(5)} → ${count} user${count !== 1 ? 's' : ''}`);
        }
        console.log("");
    }

    printDistribution("Before", beforeDistribution);
    printDistribution("After", afterDistribution);
})();