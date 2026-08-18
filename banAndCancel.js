const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// ======================= CONFIG ==========================
const TARGET_USER_IDS = [
    // Add the list of user IDs here
    // 'mUraP3cCq4XNHgUr72e08gqRrLV2',
    // 'KhPJEb1ZLWNix86qKPp5gkViVB13',
    // 'LEBwSaPYByX7ipt2YIV6JQakRfB2',
    // 'e37Vora1RTRk1MgPeQKwBmFZEas1'
    // 'Hb7C5vAhF9gWvUhIFgu8aYXifqJ3',
    // 'B1EsD0SfyBMliIR9i60TAIhd9522'
    // 'Dom4h25H9tZdbbRGAvEYVu8ExGd2',
    // 'eqVhTnNF9eZXL9FSqFZjJrrqyMt2'
    // 'e0AL8A0ONZfclrImj8kkFH9UwaZ2'
    // 'tkrZUPA8JreR0GHhtR3upJiS2WE3'
    // 'YZjSfnjj2BOKNIzhIkzRgFqEyjR2',
    // 'k3vxCmEJZkPjOefwFTcNpQsXF993',
    // 't3QYtI2cU8R207rhu5NLbsdiiwY2',
    // 'uD47YEkFN6fhl7tVvsfMetDYtwy1',
    // '59gZzsI29xQYT2KmfddwB1oNWhJ2',
    // 'tkrZUPA8JreR0GHhtR3upJiS2WE3',
    // 'KhPJEb1ZLWNix86qKPp5gkViVB13',
    // 'e37Vora1RTRk1MgPeQKwBmFZEas1',
    // 'Dom4h25H9tZdbbRGAvEYVu8ExGd2',
    // 'LfgZi6P9hlMMDyyc6R5fUiVLgKl2'
    // '9z0eO2ll22P4nv5lZDRgsFwXOyz1',
    // 'lNwXkvEEgVfJq4LXhPjaY1YvRM83',
    // '8a1IiqZPd4WCCGMJlcLdCNgF1jg2',
    // 'wvCwa36EZeWsXZgdMzcA7Lsgm7N2',
    // 'R8sBwynIJpeGR33uVihJQxVMpan2',
    // 'JsE8ylsEV9OW7qzBFKWw0rve9Od2',
    // 'y29TXsGHyFTxSR64weaBZvtsmai1',
    // 'oVgk8Rx4DDRMqDJyBWlzhbGbDOk2',
    // 'hF3f9Cugm3f3eAmqYbaL8J2vFrm2'
    // 'ZWaflzCAeZg4LFbBOFwd9nN6e5s1'
    // 'Ml8sQNskXFfL4ip4gqlzXNBMN432',
    // 'q0Vf6dov69RvlCTjStKKb71N8yh2',
    // '2Uqxiir7dmUAUtiV80cSM4iGeBC2'
    'XXX'
];

// ==========================================================

async function banUsersAndCancelGames() {
    console.log(`[START] Banning users & canceling their games... (${new Date().toISOString()})`);
    console.log(`[INFO] Target users count: ${TARGET_USER_IDS.length}`);

    let totalGamesCanceled = 0;

    for (const userId of TARGET_USER_IDS) {
        console.log(`\n[PROCESS] Handling user: ${userId}`);

        // Step 1: Check and update the user doc only if not already banned
        const userRef = db.collection('users').doc(userId);
        try {
            const userSnap = await userRef.get();
            if (!userSnap.exists) {
                console.log(`[WARN] User ${userId} not found, skipping.`);
                continue;
            }
            const userData = userSnap.data();
            if (userData.banned === true) {
                console.log(`[SKIP] User ${userId} already banned.`);
            } else {
                await userRef.update({ banned: true });
                console.log(`[UPDATE] User ${userId} marked as banned (previous state: ${userData.banned ?? 'unset'}).`);
            }
        } catch (err) {
            console.error(`[ERROR] Failed processing user ${userId}: ${err.message}`);
            continue;
        }

        // Step 2: Query and cancel only eligible games
        try {
            const gamesSnap = await db.collection('games')
                .where('organizer', '==', userId)
                .get();

            if (gamesSnap.empty) {
                console.log(`[INFO] No games found for user ${userId}.`);
                continue;
            }

            console.log(`[INFO] Found ${gamesSnap.size} game(s) organized by ${userId}. Checking eligibility...`);

            let canceledCount = 0;
            const batch = db.batch();

            gamesSnap.forEach((doc) => {
                const gameData = doc.data();
                const currentStatus = gameData.status;

                if (currentStatus === 'published' || currentStatus === 'hidden') {
                    batch.update(doc.ref, { status: 'canceled' });
                    canceledCount++;
                    console.log(`   [UPDATE] Game ${doc.id} canceled (was '${currentStatus}').`);
                } else {
                    console.log(`   [SKIP] Game ${doc.id} has status '${currentStatus}', not canceled.`);
                }
            });

            if (canceledCount > 0) {
                await batch.commit();
                totalGamesCanceled += canceledCount;
                console.log(`[SUCCESS] ${canceledCount} game(s) canceled for user ${userId}.`);
            } else {
                console.log(`[INFO] No eligible games to cancel for user ${userId}.`);
            }

        } catch (err) {
            console.error(`[ERROR] Failed processing games for user ${userId}: ${err.message}`);
        }
    }

    console.log(`\n[COMPLETE] Script finished.`);
    console.log(`[SUMMARY] Users processed: ${TARGET_USER_IDS.length}`);
    console.log(`[SUMMARY] Total games canceled: ${totalGamesCanceled}`);
    console.log(`[END] (${new Date().toISOString()})`);
}

// Run the script
banUsersAndCancelGames()
    .then(() => {
        console.log("[EXIT] Script executed successfully.");
        process.exit(0);
    })
    .catch((err) => {
        console.error(`[FATAL] Script crashed: ${err.message}`);
        process.exit(1);
    });