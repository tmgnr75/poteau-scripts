const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function queryRecentGameInvitations() {
  try {
    console.log("[INFO] Starting query on game_invitations collection...");

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    console.log(`[INFO] Current timestamp: ${now.toISOString()}`);
    console.log(`[INFO] Querying for created >= ${twentyFourHoursAgo.toISOString()}`);

    const querySnapshot = await db.collection('game_invitations')
      .where('created', '>=', twentyFourHoursAgo)
      .where('status', '==', 'pending')
      .get();

    const totalDocuments = querySnapshot.size;
    console.log(`[INFO] Total documents returned: ${totalDocuments}`);

    if (totalDocuments === 0) {
      console.log("[INFO] No game invitations found in the given time frame.");
      return;
    }

    const uniqueInvitees = new Set();
    const uniqueGames = new Set();

    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.invitee) {
        uniqueInvitees.add(data.invitee);
      }
      if (data.game) {
        uniqueGames.add(data.game);
      }
    });

    console.log(`[INFO] Unique invitee count: ${uniqueInvitees.size}`);
    console.log(`[INFO] Unique game count: ${uniqueGames.size}`);

    const gameStatusCounts = {
      published: 0,
      played: 0,
      canceled_hidden: 0,
    };

    const gameRefs = Array.from(uniqueGames);
    const gameFetchPromises = gameRefs.map(async gameRef => {
      const gameDoc = await db.doc(gameRef.path).get();
      if (gameDoc.exists) {
        const gameData = gameDoc.data();
        if (gameData.status === "published") {
          gameStatusCounts.published++;
        } else if (gameData.status === "played") {
          gameStatusCounts.played++;
        } else if (gameData.status === "canceled" || gameData.status === "hidden") {
          gameStatusCounts.canceled_hidden++;
        }
      }
    });

    await Promise.all(gameFetchPromises);

    console.log(`[INFO] Games with status 'published': ${gameStatusCounts.published}`);
    console.log(`[INFO] Games with status 'played': ${gameStatusCounts.played}`);
    console.log(`[INFO] Games with status 'canceled' or 'hidden': ${gameStatusCounts.canceled_hidden}`);

    console.log("[INFO] Query execution completed successfully.");
  } catch (error) {
    console.error("[ERROR] Failed to query game_invitations:", error);
  }
}

queryRecentGameInvitations();
