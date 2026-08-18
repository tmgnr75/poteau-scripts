const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

async function main() {
  // Get all pro users
  const proSnapshot = await db.collection('users')
    .where('type', '==', 'pro')
    .get();

  const superProSnapshot = await db.collection('users')
    .where('type', '==', 'super_pro')
    .get();

  console.log(`Found ${proSnapshot.size} pro users and ${superProSnapshot.size} super_pro users\n`);

  const allPros = [];

  const processDoc = (doc) => {
    const data = doc.data();
    allPros.push({
      uid: doc.id,
      type: data.type,
      centre_name: data.centre_name || '',
      display_name: data.display_name || '',
      email: data.email || '',
      centre_plan_status: data.centre_plan_status || '',
      centre_plan_price: data.centre_plan_price || '',
      centre_plan_periodicity: data.centre_plan_periodicity || '',
      centre_payment_type: data.centre_payment_type || data.payment_type || '',
      sports: data.sports || [],
      accounts: data.accounts || [],
      centre_country: data.centre_country || '',
      centre_currency: data.centre_currency || '',
    });
  };

  proSnapshot.forEach(processDoc);
  superProSnapshot.forEach(processDoc);

  // Sort by centre_name
  allPros.sort((a, b) => a.centre_name.localeCompare(b.centre_name));

  for (const p of allPros) {
    console.log(`UID: ${p.uid}`);
    console.log(`  Centre: ${p.centre_name}`);
    console.log(`  Display: ${p.display_name}`);
    console.log(`  Type: ${p.type}`);
    console.log(`  Plan: ${p.centre_plan_status} | Price: ${p.centre_plan_price} | Period: ${p.centre_plan_periodicity}`);
    console.log(`  Payment type: ${p.centre_payment_type}`);
    console.log(`  Sports: ${JSON.stringify(p.sports)}`);
    console.log(`  Country: ${p.centre_country} | Currency: ${p.centre_currency}`);
    console.log(`  Email: ${p.email}`);
    console.log(`  Accounts: ${JSON.stringify(p.accounts)}`);
    console.log('');
  }

  // Quick summary for matching
  console.log('\n=== QUICK MAPPING TABLE ===');
  for (const p of allPros) {
    console.log(`${p.centre_name.padEnd(35)} | ${p.uid} | ${p.centre_payment_type} | ${p.centre_plan_status}`);
  }

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
