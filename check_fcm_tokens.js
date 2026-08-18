// check_fcm_tokens.js
// Check FCM tokens subcollection for user

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const USER_ID = 'XNPognOy0OgAklzAAknSsuvjTwN2';

(async () => {
  try {
    console.log('='.repeat(60));
    console.log(`Checking FCM tokens for user: ${USER_ID}`);
    console.log('='.repeat(60));

    // Check user document
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('\n📋 User document fields:');
      console.log(`  display_name: ${userData.display_name || 'N/A'}`);
      console.log(`  email: ${userData.email || 'N/A'}`);
      console.log(`  fcm_tokens (array field): ${userData.fcm_tokens ? userData.fcm_tokens.length : 0} tokens`);
      console.log(`  last_activity_date: ${userData.last_activity_date ? userData.last_activity_date.toDate().toISOString() : 'N/A'}`);
      console.log(`  last_push_date: ${userData.last_push_date ? userData.last_push_date.toDate().toISOString() : 'N/A'}`);
      console.log(`  notification_settings: ${JSON.stringify(userData.notification_settings || {})}`);
      console.log(`  receive_emails: ${userData.receive_emails}`);
    }

    // Check fcm_tokens subcollection
    console.log('\n🔔 Checking fcm_tokens subcollection...');
    const tokensSnapshot = await db.collection('users').doc(USER_ID).collection('fcm_tokens').get();

    console.log(`  Found ${tokensSnapshot.size} document(s) in fcm_tokens subcollection`);

    if (tokensSnapshot.size > 0) {
      tokensSnapshot.forEach((doc, idx) => {
        const data = doc.data();
        console.log(`\n  Token ${idx + 1}:`);
        console.log(`    Doc ID: ${doc.id}`);
        console.log(`    fcm_token: ${data.fcm_token ? data.fcm_token.substring(0, 50) + '...' : 'N/A'}`);
        console.log(`    device_type: ${data.device_type || 'N/A'}`);
        console.log(`    created_at: ${data.created_at ? data.created_at.toDate().toISOString() : 'N/A'}`);
      });
    } else {
      console.log('\n  ❌ NO FCM TOKENS FOUND IN SUBCOLLECTION');
      console.log('  This means push notifications CANNOT be delivered to this user!');
    }

    // Check if user is in recipients of recent connect docs
    console.log('\n\n📬 Checking recent connect docs for this user...');
    const userRef = db.collection('users').doc(USER_ID);
    const recentConnects = await db.collection('connect')
      .where('recipient', 'array-contains', userRef)
      .orderBy('datetime', 'desc')
      .limit(5)
      .get();

    console.log(`  Found ${recentConnects.size} recent connect docs`);
    recentConnects.forEach((doc, idx) => {
      const data = doc.data();
      console.log(`\n  ${idx + 1}. Connect ID: ${doc.id}`);
      console.log(`     datetime: ${data.datetime ? data.datetime.toDate().toISOString() : 'N/A'}`);
      console.log(`     title: ${data.title || 'N/A'}`);
      console.log(`     source: ${data.source || 'N/A'}`);
      console.log(`     recipients count: ${data.recipient ? data.recipient.length : 0}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
})();
