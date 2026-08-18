const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function listEmailDomains() {
  console.log('Starting email domain analysis...');
  console.time('Execution Time');

  try {
    console.log('Fetching the last 10,000 user accounts sorted by creation date...');
    const usersSnapshot = await db.collection('users')
      .orderBy('created_time', 'desc') // Ensure 'created_time' is indexed
      .limit(10000)
      .get();
    
    console.log(`Retrieved ${usersSnapshot.size} user records.`);
    
    const domainCount = {};
    let processedUsers = 0;

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (!userData.email) return; // Skip if no email field
      
      const emailParts = userData.email.split('@');
      if (emailParts.length !== 2) return; // Skip invalid emails
      
      const domain = emailParts[1].toLowerCase();
      domainCount[domain] = (domainCount[domain] || 0) + 1;
      processedUsers++;
    });
    
    console.log(`Processed ${processedUsers} users with valid emails.`);
    
    // Convert to array and sort by occurrences (descending)
    const sortedDomains = Object.entries(domainCount)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => `${domain},${count}`);
    
    console.log('Complete domain count list:');
    console.log(sortedDomains.join('\n'));
  } catch (error) {
    console.error('Error fetching or processing user data:', error);
  }

  console.timeEnd('Execution Time');
  console.log('Email domain analysis complete.');
}

listEmailDomains();