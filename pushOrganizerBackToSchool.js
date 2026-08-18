const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// ---------------- CONFIG ----------------
const DATE_START = new Date("2023-09-01T00:00:00Z");
const DATE_END = new Date("2025-06-30T23:59:59Z");
const LAST_ACTIVITY_LIMIT = new Date("2025-09-05T23:59:59Z");
const DEST_GAME_ID = null; // optional: attach to a game if needed

const translations = {
    fr: {
        title: "JOUE. AU. FOOT. ⚽️",
        message: "Blocages, rentrée, météo… C'est dur de jouer au foot en ce moment ? Mais ouvre donc Poteau !!! On a des joueurs, des matchs, de nouveaux centres partenaires…"
    },
    en: {
        title: "PLAY. SOCCER. ⚽️",
        message: "Strikes, back-to-school, weather... tough to play right now? Open Poteau!!! We’ve got players, games, and new partner centers…"
    },
    es: {
        title: "JUEGA. FÚTBOL. ⚽️",
        message: "Bloqueos, regreso a clases, clima… ¿Difícil jugar ahora? ¡Abre Poteau! Tenemos jugadores, partidos y nuevos centros asociados…"
    },
    it: {
        title: "GIOCA. A. CALCIO. ⚽️",
        message: "Blocchi, rientro, meteo… Difficile giocare adesso? Ma apri Poteau!!! Ci sono giocatori, partite e nuovi centri partner…"
    }
};

// ---------------- CLI HELPER ----------------
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// ---------------- MAIN ----------------
(async () => {
    console.log("🚀 Starting campaign connect creation...");

    // 1. Query games
    console.log(`🔍 Querying games where date between ${DATE_START.toISOString()} and ${DATE_END.toISOString()}...`);
    const gamesSnap = await db.collection("games")
        .where("date", ">=", DATE_START)
        .where("date", "<=", DATE_END)
        .get();

    console.log(`📂 Found ${gamesSnap.size} games.`);

    // 2. Collect organizers
    const organizers = new Set();
    gamesSnap.forEach(doc => {
        const data = doc.data();
        if (data.organizer) {
            organizers.add(data.organizer);
        }
    });
    console.log(`✅ Collected ${organizers.size} unique organizers.`);

    // Extra confirmation before heavy/irreversible filtering
    const proceedFilter = await askQuestion(`👉 Proceed with filtering these ${organizers.size} organizers? (y/n) `);
    if (proceedFilter.toLowerCase() !== "y") {
        console.log("⏩ Aborted after organizer collection.");
        rl.close();
        return;
    }

    // 3. Filter organizers
    console.log("🔎 Checking user profiles...");
    const validUsers = [];
    let excluded = { pro: 0, banned: 0, recentlyActive: 0, missing: 0 };

    for (const userId of organizers) {
        const userRef = db.collection("users").doc(userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            excluded.missing++;
            continue;
        }

        const user = userSnap.data();
        const { type, banned, last_activity_date } = user;

        if (type === "pro") {
            excluded.pro++;
            continue;
        }
        if (banned === true) {
            excluded.banned++;
            continue;
        }
        if (last_activity_date && last_activity_date.toDate() > LAST_ACTIVITY_LIMIT) {
            excluded.recentlyActive++;
            continue;
        }

        validUsers.push(userId);
    }

    console.log("📊 Filtering summary:");
    console.log(`   ↳ Valid users: ${validUsers.length}`);
    console.log(`   ↳ Excluded (pro): ${excluded.pro}`);
    console.log(`   ↳ Excluded (banned): ${excluded.banned}`);
    console.log(`   ↳ Excluded (recently active after ${LAST_ACTIVITY_LIMIT.toISOString()}): ${excluded.recentlyActive}`);
    console.log(`   ↳ Missing docs: ${excluded.missing}`);

    // 4. Confirmation
    const answer = await askQuestion("👉 Do you want to create connect docs for these users? (y/n) ");
    if (answer.toLowerCase() !== "y") {
        console.log("⏩ Aborted. No connect docs created.");
        rl.close();
        return;
    }

    // 5. Create connect docs
    console.log("📢 Creating connect docs...");

    const batchSize = 400;
    let created = 0;

    for (let i = 0; i < validUsers.length; i += batchSize) {
        const chunk = validUsers.slice(i, i + batchSize);
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
                destination: DEST_GAME_ID ? `https://poteau.app/game/${DEST_GAME_ID}` : "https://poteau.app/",
                ...(DEST_GAME_ID && { game: [db.doc(`/games/${DEST_GAME_ID}`)] }),
                recipient: [db.doc(`/users/${userId}`)],
                sender: db.doc(`/users/Team-App`),
                source: "campaign_play_soccer",
                status: "published",
                todo: ["push"],
                type: "campaign"
            });
        }

        await batch.commit();
        created += chunk.length;
        console.log(`✅ Batch committed (${created}/${validUsers.length})`);
    }

    console.log(`🎉 Finished: ${created} connect docs created.`);
    rl.close();
})();