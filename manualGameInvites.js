const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const inviterRef = db.doc('users/Team-App');
const gameRef = db.doc('games/SWOIqEmJggzyAUuGvbiv');
const source = 'alerts';
const status = 'pending';
const created = admin.firestore.Timestamp.now();

// Convert game date to Firestore Timestamp
const gameDate = new Date('2025-03-09T10:00:00-04:00'); // 10 AM New York time (EDT)
const gameDateTimestamp = admin.firestore.Timestamp.fromDate(gameDate);

const userRefs = [
  'users/RnUYmka0gFQGvyB8PzKi7MxMvsq2',
  'users/aSrignPGTzVGEzZvOoGrsulGwZx2',
  'users/SDwWViLrLHUwHLHbuH70zH5ro7F2',
  'users/2apNcTefSUYmhdSdvUb7IDJftWu1',
  'users/FaxeIxcyk4UmV9oMGJa2cgdgUl22',
  'users/OtT6LACvqoSQ8SnEP1nHa7T8daY2',
  'users/zoc3SOQftaVO2TWGlJPCjQzrxzr2',
  'users/r1zY089L7lPGy7Qm0RCmNomJwhG3',
  'users/kRpDuvjyGyagskcZl8HV3aSvTjp1',
  'users/NuFTI1TFndYYdqcdHwaWD7293h23',
  'users/GelNpbi4UOQQZ82zqB8f2hGydHX2',
  'users/mMeVdfsxPBZG2INdfXLEnQS0R4h2',
  'users/KsEAklJiF4gZAcikQAXSjVJtpjy1',
  'users/ulyCACOqgAhhw8cUzxDIg3Pe0lf2',
  'users/3pBEHFeWpweBChTyKbrivismqKO2',
  'users/Wy5RXZJefwOZfAKG4MvOS6raU2f2'
];

async function createGameInvitations() {
  console.log('Starting game invitations creation process...');
  console.log(`Inviter: ${inviterRef.path}`);
  console.log(`Game Reference: ${gameRef.path}`);
  console.log(`Source: ${source}`);
  console.log(`Status: ${status}`);
  console.log(`Created Timestamp: ${created.toDate().toISOString()}`);
  console.log(`Game Date: ${gameDate.toISOString()} (New York Time)`);

  const batch = db.batch();

  userRefs.forEach((userPath, index) => {
    const inviteeRef = db.doc(userPath);
    const invitationRef = db.collection('game_invitations').doc(); // Auto-generate ID

    const invitationData = {
      inviter: inviterRef,
      invitee: inviteeRef,
      game: gameRef,
      source,
      status,
      created,
      game_date: gameDateTimestamp,
    };

    batch.set(invitationRef, invitationData);

    console.log(`Prepared invitation for user ${index + 1}/${userRefs.length}: ${inviteeRef.path}`);
  });

  try {
    await batch.commit();
    console.log('✅ All game invitations successfully created.');
  } catch (error) {
    console.error('❌ Error creating game invitations:', error);
  }
}

createGameInvitations();