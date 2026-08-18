const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// The 37 unique valid phone numbers from outsiders
const outsiderPhones = [
  '+33608158556',
  '+33612098372',
  '+33613870576',
  '+33617647598',
  '+33618603061',
  '+33619380343',
  '+33621085919',
  '+33622102141',
  '+33624737825',
  '+33633071709',
  '+33634360012',
  '+33640542077',
  '+33647877326',
  '+33650251142',
  '+33658058882',
  '+33666842989',
  '+33670984320',
  '+33671752468',
  '+33675734925',
  '+33677020706',
  '+33679726584',
  '+33695734925',
  '+33699063208',
  '+33745382897',
  '+33749295089',
  '+33749648407',
  '+33760036107',
  '+33763939319',
  '+33767646613',
  '+33769089920',
  '+33769816442',
  '+33781950630',
  '+33782207335',
  '+33782530000',
  '+33785741513',
  '+33785741543',
  '+33787149499'
];

// Normalize phone number for comparison (remove spaces, handle different formats)
const normalizePhone = (phone) => {
  if (!phone) return '';

  let normalized = phone.replace(/[\s]/g, '');

  // Handle different formats
  if (normalized.startsWith('+33')) {
    return normalized;
  } else if (normalized.startsWith('0')) {
    return '+33' + normalized.substring(1);
  } else if (/^\d{9}$/.test(normalized)) {
    // Just 9 digits, add +33
    return '+33' + normalized;
  }

  return normalized;
};

async function checkPhonesAgainstUsers() {
  console.log('Checking outsider phone numbers against existing users...\n');

  try {
    // Get all users
    console.log('Fetching all users...');
    const usersSnapshot = await db.collection('users').get();
    console.log(`Found ${usersSnapshot.size} total users.\n`);

    // Build a map of normalized phone numbers to user data
    const userPhoneMap = new Map();

    usersSnapshot.docs.forEach(doc => {
      const userData = doc.data();
      if (userData.phone_number) {
        const normalized = normalizePhone(userData.phone_number);
        if (normalized) {
          userPhoneMap.set(normalized, {
            userId: doc.id,
            displayName: userData.display_name || 'No name',
            email: userData.email || 'No email',
            phoneNumber: userData.phone_number
          });
        }
      }
    });

    console.log(`Found ${userPhoneMap.size} users with phone numbers.\n`);

    // Check each outsider phone
    const phonesWithUsers = [];
    const phonesWithoutUsers = [];

    outsiderPhones.forEach(phone => {
      if (userPhoneMap.has(phone)) {
        const userData = userPhoneMap.get(phone);
        phonesWithUsers.push({
          phoneNumber: phone,
          ...userData
        });
      } else {
        phonesWithoutUsers.push(phone);
      }
    });

    // Display results
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total outsider phone numbers checked: ${outsiderPhones.length}`);
    console.log(`Phone numbers that belong to existing users: ${phonesWithUsers.length}`);
    console.log(`Phone numbers NOT in users collection: ${phonesWithoutUsers.length}`);
    console.log('='.repeat(80));
    console.log('\n');

    // Display phones that belong to existing users
    console.log('='.repeat(80));
    console.log('PHONE NUMBERS THAT BELONG TO EXISTING USERS');
    console.log('='.repeat(80));
    if (phonesWithUsers.length > 0) {
      phonesWithUsers.forEach((item, index) => {
        console.log(`${index + 1}. ${item.phoneNumber}`);
        console.log(`   User ID: ${item.userId}`);
        console.log(`   Name: ${item.displayName}`);
        console.log(`   Email: ${item.email}`);
        console.log('');
      });
    } else {
      console.log('None.');
    }
    console.log('='.repeat(80));
    console.log('\n');

    // Display phones NOT in users collection (can send SMS)
    console.log('='.repeat(80));
    console.log('PHONE NUMBERS NOT IN USERS COLLECTION (CAN SEND SMS)');
    console.log('='.repeat(80));
    if (phonesWithoutUsers.length > 0) {
      phonesWithoutUsers.forEach((phone, index) => {
        console.log(`${index + 1}. ${phone}`);
      });
    } else {
      console.log('None - all outsider phone numbers belong to existing users.');
    }
    console.log('='.repeat(80));

    return {
      total: outsiderPhones.length,
      withUsers: phonesWithUsers,
      withoutUsers: phonesWithoutUsers
    };

  } catch (error) {
    console.error('An error occurred:', error.message);
    console.error(error.stack);
  }
}

// Execute the function
checkPhonesAgainstUsers()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
