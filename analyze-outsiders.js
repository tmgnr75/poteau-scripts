const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Main function to analyze outsiders for pro users
async function analyzeOutsiders() {
  console.log(`Starting script to analyze outsiders for 'pro' users from Firestore project: ${PROJECT_ID}\n`);

  try {
    // Query all pro users
    console.log('Querying all users with type == "pro"...');
    const usersSnapshot = await db.collection('users')
      .where('type', '==', 'pro')
      .get();

    console.log(`Found ${usersSnapshot.size} pro users.\n`);

    if (usersSnapshot.empty) {
      console.log('No pro users found.');
      return;
    }

    const results = [];
    let totalOutsiders = 0;
    let totalWithPhoneNumbers = 0;
    let totalWithNames = 0;
    const allNames = [];
    const allPhoneNumbers = [];

    // Process each pro user
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      const displayName = userData.display_name || 'Unknown';

      // Get outsiders subcollection for this user
      const outsidersSnapshot = await db.collection('users')
        .doc(userId)
        .collection('outsiders')
        .get();

      const outsiderCount = outsidersSnapshot.size;
      totalOutsiders += outsiderCount;

      let withPhone = 0;
      let withName = 0;
      const userNames = [];
      const userPhones = [];

      // Analyze each outsider
      outsidersSnapshot.docs.forEach(outsiderDoc => {
        const outsiderData = outsiderDoc.data();

        // Check if has phone_number field and it's not empty
        if (outsiderData.phone_number && outsiderData.phone_number.trim() !== '') {
          withPhone++;
          totalWithPhoneNumbers++;
          userPhones.push(outsiderData.phone_number);
          allPhoneNumbers.push(outsiderData.phone_number);
        }

        // Check if has name field and it's not empty
        if (outsiderData.name && outsiderData.name.trim() !== '') {
          withName++;
          totalWithNames++;
          userNames.push(outsiderData.name);
          allNames.push(outsiderData.name);
        }
      });

      // Store results for this pro user
      results.push({
        userId,
        displayName,
        totalOutsiders: outsiderCount,
        withPhoneNumbers: withPhone,
        withNames: withName,
        names: userNames,
        phoneNumbers: userPhones
      });
    }

    // Display summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total pro users: ${usersSnapshot.size}`);
    console.log(`Total outsiders across all pro users: ${totalOutsiders}`);
    console.log(`Total outsiders with phone numbers: ${totalWithPhoneNumbers}`);
    console.log(`Total outsiders with names: ${totalWithNames}`);
    console.log('='.repeat(80));
    console.log('\n');

    // Display per-user breakdown
    console.log('='.repeat(80));
    console.log('PER-USER BREAKDOWN');
    console.log('='.repeat(80));
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.displayName} (ID: ${result.userId})`);
      console.log(`   Total outsiders: ${result.totalOutsiders}`);
      console.log(`   With phone numbers: ${result.withPhoneNumbers}`);
      console.log(`   With names: ${result.withNames}`);

      if (result.names.length > 0) {
        console.log(`   Names: ${result.names.join(', ')}`);
      }

      if (result.phoneNumbers.length > 0) {
        console.log(`   Phone numbers: ${result.phoneNumbers.join(', ')}`);
      }
    });
    console.log('='.repeat(80));
    console.log('\n');

    // Display full list of all names
    console.log('='.repeat(80));
    console.log('FULL LIST OF ALL OUTSIDER NAMES');
    console.log('='.repeat(80));
    if (allNames.length > 0) {
      allNames.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
      });
    } else {
      console.log('No names found.');
    }
    console.log('='.repeat(80));
    console.log('\n');

    // Display full list of all phone numbers
    console.log('='.repeat(80));
    console.log('FULL LIST OF ALL OUTSIDER PHONE NUMBERS');
    console.log('='.repeat(80));
    if (allPhoneNumbers.length > 0) {
      allPhoneNumbers.forEach((phone, index) => {
        console.log(`${index + 1}. ${phone}`);
      });
    } else {
      console.log('No phone numbers found.');
    }
    console.log('='.repeat(80));

    // Return structured data
    return {
      summary: {
        totalProUsers: usersSnapshot.size,
        totalOutsiders,
        totalWithPhoneNumbers,
        totalWithNames
      },
      perUserBreakdown: results,
      allNames,
      allPhoneNumbers
    };

  } catch (error) {
    console.error('An error occurred while analyzing outsiders:', error.message);
    console.error(error.stack);
  }
}

// Execute the function
analyzeOutsiders()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
