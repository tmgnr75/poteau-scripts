const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

async function main() {
    console.log('--- 🧮 Poteau | Business Volume Report ---');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twelveMonthsAgo = new Date(today);
    twelveMonthsAgo.setFullYear(today.getFullYear() - 1);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    console.log(`📅 Period: ${twelveMonthsAgo.toISOString().split('T')[0]} → ${today.toISOString().split('T')[0]}`);
    console.log('Fetching games with status == "played"...');

    const snapshot = await db
        .collection('games')
        .where('status', '==', 'played')
        .where('date', '>=', twelveMonthsAgo)
        .where('date', '<', today)
        .get();

    console.log(`📊 Found ${snapshot.size} games in the period.`);

    if (snapshot.empty) {
        console.log('No played games found. Exiting.');
        process.exit(0);
    }

    const monthlyTotals = {};
    let globalTotal = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        const gameDate = data.date?.toDate?.() || data.date;
        const monthKey = `${gameDate.getFullYear()}-${String(gameDate.getMonth() + 1).padStart(2, '0')}`;

        const maxPlayers = data.max_players || 0;
        const price = data.price || 0;
        const revenue = maxPlayers * price;

        if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = 0;
        monthlyTotals[monthKey] += revenue;
        globalTotal += revenue;
    });

    console.log('\n--- 💶 Monthly Breakdown ---');
    Object.keys(monthlyTotals)
        .sort()
        .forEach((month) => {
            console.log(`${month}: ${monthlyTotals[month].toFixed(2)}€`);
        });

    console.log('----------------------------');
    console.log(`🧾 Total for last 12 months: ${globalTotal.toFixed(2)}€`);
    console.log('--- End of Report ---\n');
}

main()
    .then(() => {
        console.log('✅ Script completed successfully.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error running report:', error);
        process.exit(1);
    });