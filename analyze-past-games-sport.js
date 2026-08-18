const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function analyzePastGamesSport() {
  try {
    console.log('Analyzing past games sport field...\n');

    const now = admin.firestore.Timestamp.now();

    // Get total count of past games
    const totalPastSnapshot = await db.collection('games')
      .where('date', '<', now)
      .count()
      .get();

    const totalPast = totalPastSnapshot.data().count;
    console.log(`Total past games: ${totalPast.toLocaleString()}`);

    // Sample documents to check sport field distribution
    console.log('\nSampling 10,000 past games to estimate sport field coverage...');

    const sampleSnapshot = await db.collection('games')
      .where('date', '<', now)
      .limit(10000)
      .get();

    let withSport = 0;
    let noSport = 0;
    const sportValues = {};

    sampleSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.sport && data.sport !== '') {
        withSport++;
        sportValues[data.sport] = (sportValues[data.sport] || 0) + 1;
      } else {
        noSport++;
      }
    });

    const sampleSize = sampleSnapshot.size;
    const percentageNoSport = (noSport / sampleSize) * 100;

    console.log(`\nSample results (${sampleSize.toLocaleString()} documents):`);
    console.log(`  With sport field: ${withSport.toLocaleString()} (${((withSport/sampleSize)*100).toFixed(2)}%)`);
    console.log(`  Without sport field: ${noSport.toLocaleString()} (${percentageNoSport.toFixed(2)}%)`);

    if (Object.keys(sportValues).length > 0) {
      console.log('\n  Sport values found:');
      Object.entries(sportValues)
        .sort(([, a], [, b]) => b - a)
        .forEach(([sport, count]) => {
          console.log(`    ${sport}: ${count}`);
        });
    }

    // Estimate total documents needing update
    const estimatedNoSport = Math.round((noSport / sampleSize) * totalPast);

    console.log(`\nEstimated totals:`);
    console.log(`  Documents needing update: ${estimatedNoSport.toLocaleString()}`);
    console.log(`  Percentage: ${percentageNoSport.toFixed(2)}%`);

    // Sample a few documents without sport
    if (noSport > 0) {
      console.log('\nSample of documents without sport field:');
      let count = 0;
      for (const doc of sampleSnapshot.docs) {
        if (count >= 5) break;
        const data = doc.data();
        if (!data.sport || data.sport === '') {
          console.log(`  ID: ${doc.id}, Date: ${data.date?.toDate()}`);
          count++;
        }
      }
    }

    // Estimate costs
    // Firestore pricing: $0.06 per 100,000 document reads
    // $0.18 per 100,000 document writes
    const readCost = (estimatedNoSport / 100000) * 0.06;
    const writeCost = (estimatedNoSport / 100000) * 0.18;
    const totalCost = readCost + writeCost;

    console.log(`\nEstimated cost to update all documents without sport field:`);
    console.log(`  Reads: $${readCost.toFixed(2)}`);
    console.log(`  Writes: $${writeCost.toFixed(2)}`);
    console.log(`  Total: $${totalCost.toFixed(2)}`);

    console.log('\nDone!');

  } catch (error) {
    console.error('Error analyzing games:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

analyzePastGamesSport();
