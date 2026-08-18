const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

const mainUserRef = db.doc('/users/pE7XPM7CSRf2vbXx5JLVHkYudSJ3');

const userRefs = [
  db.doc('/users/EH4YwunToSSxWs0QLYYEcLhUp0g1'),
  db.doc('/users/UQf33jQhVZhle917nO0h7D5qclV2'),
  db.doc('/users/uaerw16hlBaNu2A8EPYWITY82np1'),
  db.doc('/users/IFAEROxomNbIlT2EkrJe6eAMmtl2'),
  db.doc('/users/MoQdaYHqMbWk0sI7N0n9inoGxKY2'),
  db.doc('/users/c6yOIkNZtROhqPufCkT3U0LJjSI3'),
  db.doc('/users/n3R2uzshLmftuthw5S5G7k14amb2'),
  db.doc('/users/nsdHc4WVJoc3dXHHOaVEnJVbJeH3'),
  db.doc('/users/kGEyV89jT3NoRJYpeC2LjzJ3J1z1'),
];

async function removeBlockedUsers() {
  console.log(`Starting unblocking process for ${userRefs.length} users...`);

  const mainUserDoc = await mainUserRef.get();
  let mainBlocked = mainUserDoc.exists ? mainUserDoc.data().blocked_users || [] : [];

  let mainBlockedModified = false;

  for (const userRef of userRefs) {
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.warn(`[SKIP] ${userRef.path} does not exist.`);
      continue;
    }

    const blocked = userDoc.data().blocked_users || [];

    // Remove main user from user's blocked_users
    const updatedBlocked = blocked.filter(ref => !ref.isEqual(mainUserRef));
    if (updatedBlocked.length !== blocked.length) {
      await userRef.update({ blocked_users: updatedBlocked });
      console.log(`[UPDATE] Removed ${mainUserRef.path} from ${userRef.path}'s blocked_users`);
    } else {
      console.log(`[UNCHANGED] ${mainUserRef.path} not found in ${userRef.path}'s blocked_users`);
    }

    // Remove user from main user's blocked_users
    if (mainBlocked.some(ref => ref.isEqual(userRef))) {
      mainBlocked = mainBlocked.filter(ref => !ref.isEqual(userRef));
      console.log(`[UPDATE] Will remove ${userRef.path} from ${mainUserRef.path}'s blocked_users`);
      mainBlockedModified = true;
    }
  }

  // Update main user only if needed
  if (mainBlockedModified) {
    await mainUserRef.update({ blocked_users: mainBlocked });
    console.log(`[FINAL] Updated ${mainUserRef.path}'s blocked_users`);
  } else {
    console.log(`[FINAL] No changes needed for ${mainUserRef.path}'s blocked_users`);
  }

  console.log('Unblocking process completed.');
}

removeBlockedUsers().catch(error => {
  console.error('Error during unblocking process:', error);
});