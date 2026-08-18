const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const stats = {
    total: 0,
    scores: [],
    selfScores: [],
    gaps: [],
    roles: {},
    withInitialScore: [],
    skillStats: {},
    initialVsRefined: [],
};

function pushToRole(role, key, value) {
    if (!stats.roles[role]) {
        stats.roles[role] = { scores: [], selfScores: [], gaps: [], skillStats: {}, initialVsRefined: [] };
    }
    stats.roles[role][key].push(value);
}

function pushSkill(role, skill, value) {
    if (!stats.skillStats[skill]) stats.skillStats[skill] = [];
    stats.skillStats[skill].push(value);

    if (!stats.roles[role].skillStats[skill]) stats.roles[role].skillStats[skill] = [];
    stats.roles[role].skillStats[skill].push(value);
}

function median(arr) {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function average(arr) {
    if (!arr.length) return null;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

async function main() {
    console.log('⏳ Fetching all quiz_scores documents…');
    const snapshot = await db.collection('quiz_scores').get();
    console.log(`📦 Found ${snapshot.size} quiz_scores documents`);

    for (const doc of snapshot.docs) {
        const data = doc.data();
        stats.total++;

        const {
            role, score, self_score, gap, score_by_skill, initial_score,
        } = data;

        if (typeof score === 'number') stats.scores.push(score);
        if (typeof self_score === 'number') stats.selfScores.push(self_score);
        if (typeof gap === 'number') stats.gaps.push(gap);
        if (initial_score !== undefined && typeof initial_score === 'number') {
            stats.withInitialScore.push({ score, initial_score });
            if (typeof score === 'number') {
                stats.initialVsRefined.push(score - initial_score);
            }
        }

        if (role) {
            if (typeof score === 'number') pushToRole(role, 'scores', score);
            if (typeof self_score === 'number') pushToRole(role, 'selfScores', self_score);
            if (typeof gap === 'number') pushToRole(role, 'gaps', gap);
            if (initial_score !== undefined && typeof initial_score === 'number' && typeof score === 'number') {
                pushToRole(role, 'initialVsRefined', score - initial_score);
            }
        }

        if (score_by_skill && typeof score_by_skill === 'object') {
            Object.entries(score_by_skill).forEach(([skill, val]) => {
                if (typeof val === 'number') pushSkill(role, skill, val);
            });
        }
    }

    console.log('\n✅ GLOBAL INSIGHTS');
    console.log(`• Total users analyzed: ${stats.total}`);
    console.log(`• Average score: ${average(stats.scores).toFixed(2)} | Median: ${median(stats.scores).toFixed(2)}`);
    console.log(`• Average self_score: ${average(stats.selfScores).toFixed(2)} | Median: ${median(stats.selfScores).toFixed(2)}`);
    console.log(`• Average gap: ${average(stats.gaps).toFixed(2)} | Median: ${median(stats.gaps).toFixed(2)}`);
    console.log(`• Users with initial_score: ${stats.withInitialScore.length}`);
    console.log(`• Avg difference (score - initial_score): ${average(stats.initialVsRefined).toFixed(2)}`);

    console.log('\n🎯 AVERAGE PER SKILL:');
    Object.entries(stats.skillStats).forEach(([skill, values]) => {
        console.log(`• ${skill}: avg ${average(values).toFixed(2)}, median ${median(values).toFixed(2)}`);
    });

    console.log('\n📊 BREAKDOWN BY ROLE:');
    Object.entries(stats.roles).forEach(([role, roleStats]) => {
        console.log(`\n🔹 Role: ${role}`);
        console.log(`  • Users: ${roleStats.scores.length}`);
        console.log(`  • Avg score: ${average(roleStats.scores).toFixed(2)} | Median: ${median(roleStats.scores).toFixed(2)}`);
        console.log(`  • Avg self_score: ${average(roleStats.selfScores).toFixed(2)}`);
        console.log(`  • Avg gap: ${average(roleStats.gaps).toFixed(2)}`);
        if (roleStats.initialVsRefined.length)
            console.log(`  • Avg diff (score - initial_score): ${average(roleStats.initialVsRefined).toFixed(2)}`);
        Object.entries(roleStats.skillStats).forEach(([skill, values]) => {
            console.log(`    ◦ ${skill}: avg ${average(values).toFixed(2)}, median ${median(values).toFixed(2)}`);
        });
    });
}

main().catch(console.error);