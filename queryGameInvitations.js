const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function queryGameInvitations() {
  try {
    console.log("[INFO] Starting query on game_invitations collection...");

    const now = new Date();
    const twelveHoursLater = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    console.log(`[INFO] Current timestamp: ${now.toISOString()}`);
    console.log(`[INFO] Querying for game_date >= ${twelveHoursLater.toISOString()} and status == 'pending'`);

    const querySnapshot = await db.collection('game_invitations')
      .where('game_date', '>=', twelveHoursLater)
      .where('status', '==', 'pending')
      .get();

    const totalDocuments = querySnapshot.size;
    console.log(`[INFO] Total documents returned: ${totalDocuments}`);

    if (totalDocuments === 0) {
      console.log("[INFO] No pending game invitations found in the given time frame.");
      return;
    }

    const uniqueInvitees = new Set();
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.invitee) {
        uniqueInvitees.add(data.invitee);
      }
    });

    console.log(`[INFO] Unique invitee count: ${uniqueInvitees.size}`);
    console.log("[INFO] Query execution completed successfully.");
  } catch (error) {
    console.error("[ERROR] Failed to query game_invitations:", error);
  }
}

queryGameInvitations();
