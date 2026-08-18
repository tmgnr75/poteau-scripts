const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

// Configuration
const USER_ID = 'iPGJt0M9QdQfe8GNIjXR0DhEZ3J2';
const DRY_RUN = false; // Set to false to actually make changes
const SKIP_REPEATERS = true; // Set to true to only cancel games (repeaters already paused)

async function main() {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`PAUSING PRO ACCOUNT: ${USER_ID}`);
    console.log(`DRY RUN: ${DRY_RUN}`);
    console.log(`SKIP REPEATERS: ${SKIP_REPEATERS}`);
    console.log(`${'='.repeat(60)}\n`);

    // 1. Fetch user info
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (!userDoc.exists) {
      console.error('User not found!');
      return;
    }
    const userData = userDoc.data();
    console.log(`User: ${userData.display_name || userData.email}`);
    console.log(`Centre: ${userData.centre_name || 'N/A'}`);
    console.log(`Current plan status: ${userData.centre_plan_status || 'N/A'}\n`);

    let repeatersCount = 0;

    // 2. Pause all published repeaters for this user (unless skipped)
    if (!SKIP_REPEATERS) {
      console.log('--- REPEATERS ---');
      const repeatersSnapshot = await db.collection('repeaters')
        .where('organizer', '==', USER_ID)
        .where('status', '==', 'published')
        .get();

      repeatersCount = repeatersSnapshot.size;
      console.log(`Found ${repeatersCount} published repeaters`);

      if (!repeatersSnapshot.empty) {
        const repeatersBatch = db.batch();
        repeatersSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log(`  - ${doc.id}: ${data.centre} | ${data.expectedTime} | ${data.sport || 'soccer'}`);
          if (!DRY_RUN) {
            repeatersBatch.update(doc.ref, {
              status: 'paused',
              paused_at: admin.firestore.Timestamp.now(),
              paused_reason: 'unpaid_invoice'
            });
          }
        });

        if (!DRY_RUN) {
          await repeatersBatch.commit();
          console.log(`\n✓ Paused ${repeatersCount} repeaters`);
        } else {
          console.log(`\n[DRY RUN] Would pause ${repeatersCount} repeaters`);
        }
      }
    } else {
      console.log('--- REPEATERS ---');
      console.log('Skipped (SKIP_REPEATERS = true)');
    }

    // 3. Cancel all future games for this user
    console.log('\n--- FUTURE GAMES ---');
    const now = new Date();
    const gamesSnapshot = await db.collection('games')
      .where('organizer', '==', USER_ID)
      .where('date', '>=', now)
      .where('status', '==', 'published')
      .get();

    console.log(`Found ${gamesSnapshot.size} future published games`);

    if (!gamesSnapshot.empty) {
      const gamesBatch = db.batch();
      let gamesWithAttendees = 0;

      gamesSnapshot.forEach((doc) => {
        const data = doc.data();
        const gameDate = data.date.toDate();
        const attendeeCount = data.attendees?.length || 0;
        if (attendeeCount > 0) gamesWithAttendees++;

        console.log(`  - ${doc.id}: ${gameDate.toISOString().slice(0, 16)} | ${data.centre} | ${attendeeCount} attendees`);

        if (!DRY_RUN) {
          gamesBatch.update(doc.ref, {
            status: 'canceled',
            canceled_at: admin.firestore.Timestamp.now(),
            canceled_reason: 'pro_account_suspended'
          });
        }
      });

      if (gamesWithAttendees > 0) {
        console.log(`\n⚠️  WARNING: ${gamesWithAttendees} games have attendees who will be affected!`);
      }

      if (!DRY_RUN) {
        await gamesBatch.commit();
        console.log(`\n✓ Canceled ${gamesSnapshot.size} games`);
      } else {
        console.log(`\n[DRY RUN] Would cancel ${gamesSnapshot.size} games`);
      }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    if (!SKIP_REPEATERS) {
      console.log(`Repeaters to pause: ${repeatersCount}`);
    }
    console.log(`Games to cancel: ${gamesSnapshot.size}`);

    if (DRY_RUN) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made.');
      console.log('Set DRY_RUN = false to execute the changes.');
    } else {
      console.log('\n✓ All changes have been applied.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    admin.app().delete();
  }
}

main();
