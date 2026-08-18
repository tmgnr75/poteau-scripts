const admin = require('firebase-admin');
const fs = require('fs');
const { parse } = require('json2csv');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// List of user document paths
const userPaths = [
  'users/vatP5ztNHtWKqOrwDR5W4Vib3ek2',
  'users/01QaD6u8HdaOivOIt8hzmvAFgJm1',
  'users/Qil98yKuzcZrbt67NfxSFY0ocvJ3',
  'users/RnUYmka0gFQGvyB8PzKi7MxMvsq2',
  'users/aSrignPGTzVGEzZvOoGrsulGwZx2',
  'users/rHnkvS3UVshTXEjhSCuAAc5pvEO2',
  'users/d13zh17QC7Pid8OAMrrZECciJBE2',
  'users/7Yi2UuDE54PvbWKQ2L8oxIhr5qq2',
  'users/aVhCXxbMkDW0PEa4TX0Nq9O1jrz1',
  'users/QSPXWcH5gjgxbTbn7b5qVW1HVzn1',
  'users/SLLDcBZQmEbsb87jZxCk7C4HWYm2',
  'users/ssdzj7zPQceBgDeqCVkQRYLiC1g1',
  'users/SDwWViLrLHUwHLHbuH70zH5ro7F2',
  'users/dFqjXag6kaP0bLuEa7IijlGvFth1',
  'users/m1DgEnzrUAgLyjb1JcgkCiiTw913',
  'users/Cm2cXu5NkdR1j9VM9gsKqjUgKJp1',
  'users/IcMd8xGJNwh3CUjKDrfIt5TxaXl1',
  'users/3rVhKfq03thuCpAJZ7HADIBr8b13',
  'users/2apNcTefSUYmhdSdvUb7IDJftWu1',
  'users/2Qj2Dr7bHFZwHVcvwoTnCGBphpV2',
  'users/Ohoot9CqVNYxuaAxIXI62jWz9nA3',
  'users/bygT5Kgv8zWHzUgXoCp5wbvslK93',
  'users/fCCTkm0NFvb8XGQHoXiLhkxad2J3',
  'users/eJN93JaiDVeFLW6wo2zk8OCmaB52',
  'users/uiXTvv4K6SNT3eFq1nLzHoQSjnm2',
  'users/FaxeIxcyk4UmV9oMGJa2cgdgUl22',
  'users/ktf2qYGcCVUoXarF4fjIv0ANo9m2',
  'users/d7PEdsWIN2eSohMtA5ARHdBifMk2',
  'users/lkXGTnPxzGYk5ArhQlXJ6TbK1dz2',
  'users/OtT6LACvqoSQ8SnEP1nHa7T8daY2',
  'users/kKd1ZilxZWaIEx2o6BnhYi0gxo03',
  'users/zoc3SOQftaVO2TWGlJPCjQzrxzr2',
  'users/26IKkBxbKUhbqpwrQu0P5DBLtOu1',
  'users/r1zY089L7lPGy7Qm0RCmNomJwhG3',
  'users/KWz9DPxGJOPBanpnPiRn9Jnth8j2',
  'users/kRpDuvjyGyagskcZl8HV3aSvTjp1',
  'users/NuFTI1TFndYYdqcdHwaWD7293h23',
  'users/HAwgJsQJPNYXmHPry2nDgt4A1do2',
  'users/GelNpbi4UOQQZ82zqB8f2hGydHX2',
  'users/NM57DQrVtxZqykZjLAgeLXKPQix1',
  'users/N94dcGWG9jdXwCV1KOPtK6WcM5R2',
  'users/Tu8zjPV7ezWjhxn9TpWs5UmUJ2w1',
  'users/cYz1TflvzIRZKnZwM5ccoQSUEs22',
  'users/NaNe704YIiO77cdaUFoUbaKFIB93',
  'users/uh1PpVSNpbOpuo7czIIEchHk5oo2',
  'users/pQEyYCwkSlQVfd8NaZHvLPqKXer2',
  'users/nlpgtZhkDMamgPUQLfp9qzAQlZB2',
  'users/70O9Wi8PWyTwV0BmEmiIh1zWOtB3',
  'users/CwBI0BQd0nT4A7tkKC1V9RbpLWX2',
  'users/mMeVdfsxPBZG2INdfXLEnQS0R4h2',
  'users/g6Txbt4lXYUnooiSpqFpmbIhcFF3',
  'users/DMy3kBBtffPZ3LBEP9OHg62YoqF2',
  'users/D2lqsnB03ohkRedquCpNcNzfXjq1',
  'users/iA14t1WhAJXE5E3W2z0JHnbkpBA3',
  'users/9Km4QcR62PeiHkH9qhXicRkno8z1',
  'users/Voy3nc3lhccizX9VjpXW8aACj4C3',
  'users/RHDUtsBl1UhKkWO0Sc7ARYdzPdt2',
  'users/1HKuDxFkdNaWMzbEIHKZUccnfCG2',
  'users/KsEAklJiF4gZAcikQAXSjVJtpjy1',
  'users/ulyCACOqgAhhw8cUzxDIg3Pe0lf2',
  'users/cow8f9Ew6zTTBandRJvPiSdnRBg2',
  'users/3pBEHFeWpweBChTyKbrivismqKO2',
  'users/uILuIEkj0cdhEDvAWTrqKl5CWcC2',
  'users/fpE88N7TipTLSffJOpdgWigJuRG2',
  'users/cdaJjUowiPMmeoX4zZEys5Aj67o1',
  'users/M8MWgJOlR0hOLmxxHJGzJa1h7zd2',
  'users/bgilpas3UUUPBmozPP9GnI1b3V83'
];

async function fetchUserData() {
  console.log('Starting user data export...');

  const userData = [];

  for (const path of userPaths) {
    const docRef = db.doc(path);
    const doc = await docRef.get();
    if (doc.exists) {
      console.log(`✅ Fetched: ${path}`);
      userData.push(doc.data());
    } else {
      console.warn(`⚠️ Missing: ${path}`);
    }
  }

  // Convert to CSV
  const csv = parse(userData, { fields: ['email', 'first_name', 'display_name', 'phone_number'] });

  fs.writeFileSync('users_export.csv', csv);
  console.log('✅ Export completed: users_export.csv');
}

fetchUserData().catch(console.error);