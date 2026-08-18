const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// ---------------- CONFIG ----------------
const CUTOFF_DATE = new Date("2025-09-01T00:00:00Z");
const DEST_GAME_ID = null; // optional attach game if needed

// Campaign contents
const contentA = {
    fr: {
        title: "Découvre ton niveau sur Poteau 🎚️",
        message: "Ton score au foot de 1 à 10, en quelques secondes… Ça te chauffe ? Ouvre Poteau pour trouver ton niveau et jouer au foot cette semaine 👊"
    },
    en: { title: "Discover your level on Poteau 🎚️", message: "Your soccer score from 1 to 10 in seconds… Wanna try? Open Poteau to find your level and play this week 👊" },
    es: { title: "Descubre tu nivel en Poteau 🎚️", message: "Tu nivel de fútbol del 1 al 10 en segundos… ¿Te animas? Abre Poteau y juega esta semana 👊" },
    it: { title: "Scopri il tuo livello su Poteau 🎚️", message: "Il tuo punteggio a calcio da 1 a 10 in pochi secondi… Ti va? Apri Poteau e gioca questa settimana 👊" }
};

const contentB = {
    fr: {
        title: "Joue au foot cette semaine ⚽️",
        message: "Trouve un moment pour faire un foot dans les prochains jours ! Si tu as déjà un match prévu, trouve des joueurs en quelques minutes grâce à la communauté Poteau 👊"
    },
    en: { title: "Play soccer this week ⚽️", message: "Find a moment to play in the next few days! Already got a game? Find players in minutes thanks to the Poteau community 👊" },
    es: { title: "Juega fútbol esta semana ⚽️", message: "Busca un momento para jugar en los próximos días. ¿Ya tienes partido? Encuentra jugadores en minutos con la comunidad Poteau 👊" },
    it: { title: "Gioca a calcio questa settimana ⚽️", message: "Trova un momento per giocare nei prossimi giorni! Hai già una partita? Trova giocatori in pochi minuti con la community Poteau 👊" }
};

// ---------------- CLI HELPER ----------------
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function askQuestion(query) { return new Promise(resolve => rl.question(query, resolve)); }

// ---------------- MAIN ----------------
(async () => {
    console.log("🚀 Starting user campaign connect creation...");

    // 1. Query users
    console.log(`🔍 Querying users created before ${CUTOFF_DATE.toISOString()} and inactive since then...`);
    const usersSnap = await db.collection("users")
        .where("created_time", "<", CUTOFF_DATE)
        .where("last_activity_date", "<", CUTOFF_DATE)
        .get();

    console.log(`📂 Found ${usersSnap.size} users.`);

    // 2. Filter banned
    const validUsers = [];
    let excluded = { banned: 0, missing: 0 };

    usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.banned === true) {
            excluded.banned++;
        } else {
            validUsers.push({ id: doc.id, data });
        }
    });

    console.log("📊 Filtering summary:");
    console.log(`   ↳ Valid users: ${validUsers.length}`);
    console.log(`   ↳ Excluded (banned): ${excluded.banned}`);

    // 3. Confirm
    const proceed = await askQuestion("👉 Do you want to create connect docs for these users? (y/n) ");
    if (proceed.toLowerCase() !== "y") {
        console.log("⏩ Aborted. No connect docs created.");
        rl.close();
        return;
    }

    // 4. Create connect docs
    console.log("📢 Creating connect docs...");

    const batchSize = 400;
    let created = 0;

    for (let i = 0; i < validUsers.length; i += batchSize) {
        const chunk = validUsers.slice(i, i + batchSize);
        const batch = db.batch();

        for (const { id, data } of chunk) {
            const docRef = db.collection("connect").doc();
            const hasSkill = data.soccer_skill_level !== undefined && data.soccer_skill_level !== null;
            const content = hasSkill ? contentB : contentA;

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
                destination: DEST_GAME_ID ? `https://poteau.app/game/${DEST_GAME_ID}` : "https://poteau.app/",
                ...(DEST_GAME_ID && { game: [db.doc(`/games/${DEST_GAME_ID}`)] }),
                recipient: [db.doc(`/users/${id}`)],
                sender: db.doc(`/users/Team-App`),
                source: hasSkill ? "campaign_play_soccer_B" : "campaign_play_soccer_A",
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