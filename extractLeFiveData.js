const admin = require('firebase-admin');
const { DateTime } = require('luxon');
const XLSX = require('xlsx');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const centers = {
    "Bezons": "U3MriTZbPbTUEsU6RtRuHxDMKvg2",
    "Bobigny": "4owi3i7t8EOvFNF6UQvACOpiDRy1",
    "Bordeaux": "kiDzYpNkEQWCYPKWN7rYKH3iQrp2",
    "Champigny": "evlV9mUgATYQ5343zpYZvk4w0r03",
    "Créteil": "ZmXMWx7aTdPoPkkGOWa2HIQVblq2",
    "Marville": "1GfAHFfqO6dOj37bPrTRuDS5gnk1",
    "Montreuil": "u9uC1vjdcdQ3UqNxI0SiFxor0m43",
    "OL": "CtMIzMx3atVuH1nKNOJj6lNQL4A2",
    "Orléans F.": "aK807pAjR0fYf1xp6STGgehCREy2",
    "Orléans I.": "MPZxHmcILxgz4kEOK1s2K6T7BiC3",
    "Reims": "LQNolHuVyKhlYeq7dQTMNOM0Onu2",
    "Paris 13": "FjSnzlRFFfhWVWQJGfIEwRc2ZMj2",
    "Paris 17": "V6mqbc9C8FNa1RQlUupjeoqOsZL2",
    "Paris 18": "UQf33jQhVZhle917nO0h7D5qclV2",
    "Valenciennes": "lMCb8tXt3sUq1XWRQSEHiAvQvnX2",
    "Villette": "IzKPWsB4aacK86ccCoYIsIi4bEH3"
};

// Define date range
const startDate = DateTime.fromISO("2025-04-01T00:00:00", { zone: "Europe/Paris" });
const endDate = DateTime.fromISO("2025-10-01T00:00:00", { zone: "Europe/Paris" });

async function generateReport() {
    console.log("🧠 Starting LE FIVE detailed report generation...");
    console.log(`📅 Period: ${startDate.toISODate()} → ${endDate.toISODate()}`);

    const rows = [];

    for (const [centerName, centerId] of Object.entries(centers)) {
        console.log(`\n🏟️ Processing center: ${centerName} (${centerId})`);

        try {
            console.log(`🔎 Querying games for ${centerName}...`);
            const snapshot = await db.collection('games')
                .where('organizer', '==', centerId)
                .where('date', '>=', startDate.toJSDate())
                .where('date', '<', endDate.toJSDate())
                .get();

            console.log(`📄 Found ${snapshot.size} games.`);

            snapshot.forEach(doc => {
                const game = doc.data();
                const { status, date, price, attendees, max_players, organizer } = game;

                if (!date) return;

                const dt = DateTime.fromJSDate(date.toDate(), { zone: 'Europe/Paris' });
                const formattedDate = dt.toFormat('yyyy-LL-dd HH:mm');

                rows.push({
                    id: doc.id,
                    status: status || "",
                    date: formattedDate,
                    price: price || 0,
                    attendees: Array.isArray(attendees) ? attendees.length : 0,
                    max_players: max_players || 0,
                    organizer: organizer || ""
                });
            });

        } catch (err) {
            console.error(`❌ Error while processing ${centerName}:`, err);
        }
    }

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Games");
    XLSX.writeFile(workbook, "lefive_games_export.xlsx");
    console.log("✅ Exported to lefive_games_export.xlsx");
}

generateReport();