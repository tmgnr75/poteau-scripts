const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// CONFIG
const TARGET_CENTRE = "Foot-Max Argenteuil";
const TARGET_PLACE_ID = "ChIJi9oIzaRm5kcRJYcK7QsdRMU";
const DEST_GAME_ID = "WbSOIyEmtrOYetfciMOG"; // optional: game to attach to connect doc

const translations = {
    fr: {
        title: "Nouveau centre sur Poteau 🏟️",
        message:
            "Tu aimes Foot-Max Argenteuil ? Les responsables viennent d'ouvrir IMPULSTAR PARK, un tout nouveau centre à Cormeilles, à 4 minutes en voiture. Viens découvrir les nouveaux terrains en rejoignant un match sur Poteau."
    },
    en: {
        title: "New center on Poteau 🏟️",
        message:
            "Do you like Foot-Max Argenteuil? The managers have just opened IMPULSTAR PARK, a brand new center in Cormeilles, only 4 minutes away by car. Come discover the new fields by joining a game on Poteau."
    },
    es: {
        title: "Nuevo centro en Poteau 🏟️",
        message:
            "¿Te gusta Foot-Max Argenteuil? Los responsables acaban de abrir IMPULSTAR PARK, un nuevo centro en Cormeilles, a solo 4 minutos en coche. Ven a descubrir los nuevos campos uniéndote a un partido en Poteau."
    },
    it: {
        title: "Nuovo centro su Poteau 🏟️",
        message:
            "Ti piace Foot-Max Argenteuil? I responsabili hanno appena aperto IMPULSTAR PARK, un nuovo centro a Cormeilles, a soli 4 minuti in auto. Vieni a scoprire i nuovi campi partecipando a una partita su Poteau."
    }
};

// CLI helpers
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

(async () => {
    console.log("🚀 Starting Push campaign target collection...");

    const targetsFromGames = new Set();
    const targetsFromAlerts = new Set();

    // ------------------------------
    // 1. Query games
    // ------------------------------
    console.log(`🔍 Querying games for centre="${TARGET_CENTRE}" or placeId=${TARGET_PLACE_ID}...`);
    const [gamesSnap1, gamesSnap2] = await Promise.all([
        db.collection("games").where("centre", "==", TARGET_CENTRE).get(),
        db.collection("games").where("centre_place_id", "==", TARGET_PLACE_ID).get()
    ]);

    const allGamesDocs = [...gamesSnap1.docs, ...gamesSnap2.docs];
    console.log(`📂 Found ${allGamesDocs.length} matching game docs.`);

    for (const gameDoc of allGamesDocs) {
        const game = gameDoc.data();
        const { attendees = [], interested = [] } = game;

        attendees.forEach(ref => ref?.id && targetsFromGames.add(ref.id));
        interested.forEach(ref => ref?.id && targetsFromGames.add(ref.id));
    }
    console.log(`✅ Collected ${targetsFromGames.size} unique users from games.`);

    // ------------------------------
    // 2. Query alerts
    // ------------------------------
    console.log(`🔍 Querying alerts with places containing centre/placeId...`);
    const alertsSnap = await db.collection("alerts").get();
    console.log(`📂 Scanning ${alertsSnap.size} alerts docs... (⚠️ heavy)`);

    let matchedAlerts = 0;
    for (const alertDoc of alertsSnap.docs) {
        const alert = alertDoc.data();
        const { places = [], user } = alert;

        const match = places.some(
            p => p.centre === TARGET_CENTRE || p.placeId === TARGET_PLACE_ID
        );

        if (match && user?.id) {
            targetsFromAlerts.add(user.id);
            matchedAlerts++;
        }
    }
    console.log(`✅ Collected ${targetsFromAlerts.size} unique users from alerts (matched ${matchedAlerts} docs).`);

    // ------------------------------
    // 3. Combine
    // ------------------------------
    const allTargets = new Set([...targetsFromGames, ...targetsFromAlerts]);
    console.log("\n🎯 Target summary:");
    console.log(`   ↳ From games:  ${targetsFromGames.size}`);
    console.log(`   ↳ From alerts: ${targetsFromAlerts.size}`);
    console.log(`   📊 TOTAL uniques: ${allTargets.size}\n`);

    // ------------------------------
    // 4. Ask confirmation
    // ------------------------------
    const answer = await askQuestion("👉 Do you want to create connect docs for these users? (y/n) ");
    if (answer.toLowerCase() !== "y") {
        console.log("⏩ Aborted. No connect docs created.");
        rl.close();
        return;
    }

    // ------------------------------
    // 5. Create connect docs (batched)
    // ------------------------------
    console.log("📢 Creating connect docs...");

    const targetArray = Array.from(allTargets);
    const batchSize = 400;
    let created = 0;

    for (let i = 0; i < targetArray.length; i += batchSize) {
        const chunk = targetArray.slice(i, i + batchSize);
        const batch = db.batch();

        for (const userId of chunk) {
            const docRef = db.collection("connect").doc();
            batch.set(docRef, {
                datetime: admin.firestore.FieldValue.serverTimestamp(),
                title: translations.fr.title,
                title_en: translations.en.title,
                title_es: translations.es.title,
                title_it: translations.it.title,
                message: translations.fr.message,
                message_en: translations.en.message,
                message_es: translations.es.message,
                message_it: translations.it.message,
                destination: `https://poteau.app/game/${DEST_GAME_ID}`,
                game: [db.doc(`/games/${DEST_GAME_ID}`)],
                recipient: [db.doc(`/users/${userId}`)],
                sender: db.doc(`/users/Team-App`),
                source: "campaign_impulstar_launch",
                status: "published",
                todo: ["push"],
                type: "campaign"
            });
        }

        await batch.commit();
        created += chunk.length;
        console.log(`✅ Batch committed (${created}/${allTargets.size})`);
    }

    console.log(`🎉 Finished: ${created} connect docs created.`);
    rl.close();
})();