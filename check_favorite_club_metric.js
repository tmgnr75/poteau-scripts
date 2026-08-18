const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function getUsersStats() {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const activeUsersQuery = await db
    .collection('users')
    .where('last_activity_date', '>=', sixtyDaysAgo)
    .get();

  const usersWithFavoriteClubQuery = await db
    .collection('users')
    .where('favorite_club', '!=', null)
    .get();

  // Calculate the intersection of active users and users with a favorite club
  const activeUsers = activeUsersQuery.docs.map((doc) => doc.id);
  const usersWithFavoriteClub = usersWithFavoriteClubQuery.docs.map((doc) => doc.id);

  const activeUsersWithFavoriteClub = activeUsers.filter((userId) =>
    usersWithFavoriteClub.includes(userId)
  );

  const activeUsersCount = activeUsers.length;
  const totalUsersCount = usersWithFavoriteClub.length;

  const percentageActiveUsers = (activeUsersWithFavoriteClub.length / totalUsersCount) * 100;

  console.log(`Total Users: ${totalUsersCount}`);
  console.log(`Active Users in the Last 60 Days with a Favorite Club: ${activeUsersWithFavoriteClub.length}`);
  console.log(`Percentage: ${percentageActiveUsers.toFixed(2)}%`);
}

getUsersStats()
  .then(() => {
    console.log('Stats calculation completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error calculating stats:', error);
    process.exit(1);
  });