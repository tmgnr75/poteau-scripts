// createConnectForImpacted.js

const admin = require("firebase-admin");
const fs = require("fs");
const readline = require("readline");

// --- Firebase Init ---
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
const PROJECT_ID = "krank-club"; // Replace if needed

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// --- Campaign contents ---
const contentA = {
    fr: {
        title: "Les inscriptions sont de retour ☑",
        message: "Notre maintenance est terminée, tu peux rejoindre des matchs à nouveau. On est désolé pour le désagrément, c'est reparti pour le foot ⚽️"
    },
    en: {
        title: "Signups are back ☑",
        message: "Maintenance is over, you can join games again. Sorry for the inconvenience — soccer’s back on ⚽️"
    },
    es: {
        title: "Las inscripciones han vuelto ☑",
        message: "El mantenimiento ha terminado, ya puedes unirte a partidos de nuevo. Perdona las molestias, ¡volvemos al fútbol! ⚽️"
    },
    it: {
        title: "Le iscrizioni sono tornate ☑",
        message: "La manutenzione è terminata, puoi unirti di nuovo alle partite. Ci scusiamo per il disagio, si riparte col calcio ⚽️"
    }
};

// --- Helper: CLI ask ---
function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) =>
        rl.question(query, (ans) => {
            rl.close();
            resolve(ans);
        })
    );
}

// --- Main ---
(async () => {
    try {
        console.log("🔍 Loading impacted user IDs from impactedByShortage2.json...");
        const impacted = require("./impactedByShortage2.json");

        if (!Array.isArray(impacted)) {
            throw new Error("impactedByShortage.js must export an array of {user_id}");
        }
        console.log(`📦 Found ${impacted.length} impacted users.`);

        // Fetch users
        console.log("📡 Fetching user docs from Firestore...");
        const validUsers = [];
        for (const { user_id } of impacted) {
            const ref = db.collection("users").doc(user_id);
            const snap = await ref.get();
            if (!snap.exists) {
                console.warn(`⚠️ User doc not found: ${user_id}`);
                continue;
            }
            const data = snap.data() || {};
            validUsers.push({ id: user_id, data });
        }
        console.log(`✅ Loaded ${validUsers.length} valid user docs.`);

        // Confirm
        const proceed = await askQuestion(
            "👉 Do you want to create connect docs for these users? (y/n) "
        );
        if (proceed.toLowerCase() !== "y") {
            console.log("⏩ Aborted. No connect docs created.");
            return;
        }

        console.log("📢 Creating connect docs...");
        const batchSize = 400;
        let created = 0;
        const DEST_GAME_ID = null; // Or put a gameId if you want to link to one

        for (let i = 0; i < validUsers.length; i += batchSize) {
            const chunk = validUsers.slice(i, i + batchSize);
            const batch = db.batch();

            for (const { id, data } of chunk) {
                const docRef = db.collection("connect").doc();
                const content = contentA;

                batch.set(docRef, {
                    datetime: admin.firestore.FieldValue.serverTimestamp(),
                    title: content.fr.title,
                    title_en: content.en.title,
                    title_es: content.es.title,
                    title_it: content.it.title,
                    message: content.fr.message,
                    message_en: content.en.message,
                    message_es: content.es.message,
                    message_it: content.it.message,
                    recipient: [db.doc(`/users/${id}`)],
                    sender: db.doc(`/users/Team-App`),
                    source: "campaign_maintenance",
                    status: "published",
                    todo: ["push"],
                    type: "campaign",
                });
            }

            await batch.commit();
            created += chunk.length;
            console.log(
                `✅ Batch committed (${created}/${validUsers.length}) so far...`
            );
        }

        console.log(`🎉 Finished: ${created} connect docs created.`);
    } catch (err) {
        console.error("❌ Script failed:", err);
    }
})();