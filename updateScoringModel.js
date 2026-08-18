/**
 * Recalculate all soccer quiz scores made before August 5, 2025 18:30 Paris time
 * and notify affected users via a localized connect message (multi-language).
 *
 * Steps:
 *  1. Query `quiz_scores` before cutoff date.
 *  2. For each score:
 *     - Skip if initial_score exists or score unchanged.
 *     - Fetch quiz_reply and recalculate with new scoring model.
 *     - Save old score to initial_score, update new score.
 *     - Update users.soccer_skill_level with new score.
 *     - Send connect doc with FR/EN/ES/IT messages, todo: ["push"], type: "score_update".
 *  3. Manual Y/N confirmation for each before updating.
 */

const admin = require('firebase-admin');
const readline = require("readline");

// Load service account key
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Cutoff time: Paris 18:30 = UTC 16:30
const CUTOFF_DATE = new Date("2025-08-14T16:30:00Z");
const DEFAULT_LANG = "fr";

const SKIPPED_USER_IDS = new Set([
    "Wy5RXZJefwOZfAKG4MvOS6raU2f2",
    "ClWRq4K6DSNHNfyR8ScOcd1XCKp2",
    "temp_yF62YbCR3k", // Redundant since temp_ already handled, but safe
]);

// CLI prompt setup
// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });
// function askQuestion(query) {
//     return new Promise(resolve => rl.question(query, resolve));
// }

// ---------------------------
//  TRANSLATIONS
// ---------------------------
// ### FIRST UPDATE
const translations = {
    fr: {
        title: "Ton score a été mis à jour 🎚️",
        message: (oldScore, newScore) =>
            `Comme toi, des milliers de joueurs ont défini leur niveau grâce au Quiz Poteau.\n\nOn vient d'ajuster ton score pour mieux refléter tes réponses.\nAncien : ${oldScore} // Nouveau : ${newScore} ⚽️`
    },
    en: {
        title: "Your score has been updated 🎚️",
        message: (oldScore, newScore) =>
            `Like thousands of players, you set your level with the Poteau Quiz.\n\nWe’ve adjusted your score to better match your answers.\nOld: ${oldScore} // New: ${newScore} ⚽️`
    },
    es: {
        title: "Tu puntuación ha sido actualizada 🎚️",
        message: (oldScore, newScore) =>
            `Como miles de jugadores, definiste tu nivel con el Quiz de Poteau.\n\nHemos ajustado tu puntuación para reflejar mejor tus respuestas.\nAnterior: ${oldScore} // Nuevo: ${newScore} ⚽️`
    },
    it: {
        title: "Il tuo punteggio è stato aggiornato 🎚️",
        message: (oldScore, newScore) =>
            `Come migliaia di giocatori, hai definito il tuo livello con il Quiz di Poteau.\n\nAbbiamo aggiornato il tuo punteggio per riflettere meglio le tue risposte.\nVecchio: ${oldScore} // Nuovo: ${newScore} ⚽️`
    }
};

// ### SECOND UPDATE
// const translations = {
//     fr: {
//         title: "Mise à jour pour les gardiens 🧤",
//         message: (oldScore, newScore) =>
//             `On a recalculé les scores des gardiens de but de la communauté.\n\nAncien score : ${oldScore} // Nouveau score : ${newScore} ⚽️`
//     },
//     en: {
//         title: "Update for Goalkeepers 🧤",
//         message: (oldScore, newScore) =>
//             `We've recalculated the scores of goalkeepers in the community.\n\nOld score: ${oldScore} // New score: ${newScore} ⚽️`
//     },
//     es: {
//         title: "Actualización para los porteros 🧤",
//         message: (oldScore, newScore) =>
//             `Hemos recalculado las puntuaciones de los porteros de la comunidad.\n\nPuntuación anterior: ${oldScore} // Nueva puntuación: ${newScore} ⚽️`
//     },
//     it: {
//         title: "Aggiornamento per i portieri 🧤",
//         message: (oldScore, newScore) =>
//             `Abbiamo ricalcolato i punteggi dei portieri della community.\n\nPunteggio vecchio: ${oldScore} // Nuovo punteggio: ${newScore} ⚽️`
//     }
// };

// ---------------------------
//  SCORING LOGIC
// ---------------------------
function computeMetaCoef(answers) {
    const metaAnswers = answers.filter(a => a.tested_skill === 'meta');
    if (!metaAnswers.length) return 1.0;

    const ratings = { q13: 7, q14: 3, q15: 1, q16: 2, q17: 4, q18: 3, q19: 1, q20: 1 };
    const totalRating = Object.values(ratings).reduce((sum, r) => sum + r, 0);
    const weights = {};
    for (const q in ratings) weights[q] = ratings[q] / totalRating;

    let total = 0;
    for (const a of metaAnswers) {
        const norm = a.score / 12;
        let mapped;
        if (norm >= 0.95) mapped = 1.15;
        else if (norm >= 0.85) mapped = 1.05;
        else if (norm >= 0.75) mapped = 1.0;
        else if (norm >= 0.65) mapped = 0.9;
        else if (norm >= 0.55) mapped = 0.75;
        else mapped = 0.6;
        total += mapped * (weights[a.question] || 0);
    }

    return Math.min(total, 1.1); // cap
}

function scoreSoccerFieldPlayer(quizReply) {
    const skills = ['pace', 'shooting', 'passing', 'dribbling', 'defence', 'physicality'];
    const roleCoeffs = {
        defender: { pace: 0.15, shooting: 0.05, passing: 0.10, dribbling: 0.05, defence: 0.35, physicality: 0.30 },
        midfielder: { pace: 0.15, shooting: 0.15, passing: 0.25, dribbling: 0.20, defence: 0.15, physicality: 0.10 },
        forward: { pace: 0.15, shooting: 0.30, passing: 0.15, dribbling: 0.25, defence: 0.05, physicality: 0.10 }
    }[quizReply.role];
    const answers = Object.values(quizReply.answers || {});
    const skillScores = {};
    let weightedAvg = 0;

    for (const skill of skills) {
        const relevant = answers.filter(a => a.tested_skill === skill);
        if (!relevant.length) { skillScores[skill] = 0; continue; }
        const scores = relevant.map(a => a.score).sort((a, b) => a - b);
        const mid = Math.floor(scores.length / 2);
        const avg = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
        const norm = avg / 12;
        const skillScore = Math.min(10, 10 * Math.pow(norm, 0.8));
        weightedAvg += skillScore * roleCoeffs[skill];
        skillScores[skill] = Math.round(skillScore * 10) / 10;
    }

    const metaCoef = computeMetaCoef(answers);
    const finalScore = 3 + (weightedAvg * 0.6) * metaCoef;
    return {
        score_by_skill: skillScores,
        score: Math.min(10, Math.round(finalScore * 10) / 10)
    };
}

function scoreSoccerGoalkeeper(quizReply) {
    const skills = ['reflexes', 'shot_stopping', 'one_on_one', 'positioning', 'footwork', 'communication'];
    const gkCoeffs = { reflexes: 0.25, shot_stopping: 0.25, one_on_one: 0.15, positioning: 0.15, footwork: 0.10, communication: 0.10 };
    const answers = Object.values(quizReply.answers || {});
    const skillScores = {};
    let weightedAvg = 0;

    for (const skill of skills) {
        const relevant = answers.filter(a => a.tested_skill === skill);
        if (!relevant.length) { skillScores[skill] = 0; continue; }
        const scores = relevant.map(a => a.score).sort((a, b) => a - b);
        const mid = Math.floor(scores.length / 2);
        const avg = scores.length % 2 ? scores[mid] : (scores[mid - 1] + scores[mid]) / 2;
        const norm = avg / 12;
        const skillScore = Math.min(10, 10 * Math.pow(norm, 0.8));
        weightedAvg += skillScore * gkCoeffs[skill];
        skillScores[skill] = Math.round(skillScore * 10) / 10;
    }

    const metaCoef = computeMetaCoef(answers);
    const finalScore = 3 + (weightedAvg * 0.6) * metaCoef;
    return {
        score_by_skill: skillScores,
        score: Math.min(10, Math.round(finalScore * 10) / 10)
    };
}

// ---------------------------
//  MAIN SCRIPT
// ---------------------------
(async () => {
    console.log(`🚀 Starting automatic score recalculation...`);
    console.log(`📅 Cutoff date: ${CUTOFF_DATE.toISOString()}`);

    const scoresSnap = await db.collection("quiz_scores")
        .where("calculated_on", "<", CUTOFF_DATE)
        .where("sport", "==", "soccer")
        // .where("role", "==", "goalkeeper")
        .get();

    console.log(`🔍 Found ${scoresSnap.size} quiz_scores before cutoff.`);

    let processedCount = 0;
    for (const scoreDoc of scoresSnap.docs) {
        const scoreData = scoreDoc.data();

        const replySnap = await db.collection("quiz_replies").doc(scoreData.quiz_reply_id).get();
        if (!replySnap.exists) {
            console.warn(`⚠️ quiz_reply not found, skipping.`);
            continue;
        }
        const replyData = replySnap.data();

        const newResult = replyData.role === "goalkeeper"
            ? scoreSoccerGoalkeeper(replyData)
            : scoreSoccerFieldPlayer(replyData);

        const oldScore = Number(scoreData.score);
        const oldScoreDisplay = oldScore.toFixed(1);
        const newScore = Number(newResult.score);
        const newScoreDisplay = newScore.toFixed(1);

        if (oldScore === newScore) {
            console.log(`⏩ Scores identical (${oldScore}), skipping.`);
            continue;
        }

        const userId = scoreData.user_id;

        if (userId.startsWith("temp_")) {
            console.log(`🚫 Skipping temp user: ${userId}`);
            continue;
        }

        if (SKIPPED_USER_IDS.has(userId)) {
            console.log(`⏩ Skipping user ${userId} (already handled)`);
            continue;
        }

        const userSnap = await db.collection("users").doc(userId).get();
        let userLang = DEFAULT_LANG;
        if (userSnap.exists && translations[userSnap.data().language]) {
            userLang = userSnap.data().language;
        }

        console.log(`\n👤 User: ${scoreData.user_id}`);
        console.log(`📊 Old score: ${oldScoreDisplay}`);
        console.log(`📈 New score: ${newScoreDisplay}`);
        // console.log(`🧠 Breakdown:`, newResult.score_by_skill);

        // const answer = await askQuestion("👉 Proceed with update? (y/n) ");
        // if (answer.toLowerCase() !== 'y') {
        //     console.log("⏩ Skipped.");
        //     continue;
        // }

        // Update quiz_scores doc
        await scoreDoc.ref.update({
            initial_score: oldScore,
            score: newScore,
            score_by_skill: newResult.score_by_skill,
            recalculated_on: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Update user's soccer_skill_level
        await db.collection("users").doc(scoreData.user_id).update({
            soccer_skill_level: newScore
        });

        // Create connect doc
        await db.collection("connect").add({
            datetime: admin.firestore.FieldValue.serverTimestamp(),
            title: translations.fr.title,
            title_en: translations.en.title,
            title_es: translations.es.title,
            title_it: translations.it.title,
            message: translations.fr.message(oldScoreDisplay, newScoreDisplay),
            message_en: translations.en.message(oldScoreDisplay, newScoreDisplay),
            message_es: translations.es.message(oldScoreDisplay, newScoreDisplay),
            message_it: translations.it.message(oldScoreDisplay, newScoreDisplay),
            recipient: [db.doc(`/users/${scoreData.user_id}`)],
            sender: db.doc(`/users/Team-App`),
            source: "score_update",
            status: "published",
            todo: ["push"],
            type: "score_update",
            picture: "https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/images%2Fklopp_counting.gif?alt=media&token=2d0efaca-65fb-4f87-b6f8-45e7b43c38ad"
        });

        console.log(`✅ Updated and sent notification.`);
        processedCount++;
    }

    console.log(`\n🎯 Finished processing ${processedCount} users.`);
})();