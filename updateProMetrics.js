const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: "gs://krank-club.appspot.com/"
});

const db = admin.firestore();

async function updateProMetrics() {
    try {
        console.log('Fetching pro users...');
        // Fetch all users documents where type == pro and centre_plan_status != expired
        const usersSnapshot = await db.collection('users')
            .where('type', '==', 'pro')
            .where('centre_plan_status', '!=', 'expired')
            .get();

        console.log(`Processing ${usersSnapshot.size} pro users...`);
        // Process each user document
        for (const userDoc of usersSnapshot.docs) {
            const userRef = userDoc.ref;
            console.log(`Processing user: ${userDoc.data().display_name} (${userRef.id})`);

            // Fetch games by centre
            const gamesSnapshotByCentre = await db.collection('games').where('centre', '==', userDoc.data().display_name).get();
            // Fetch games by place_id
            const gamesSnapshotByPlaceId = await db.collection('games').where('place_id', '==', userDoc.data().centre_place_id).get();

            // Merge the two lists into a new list with only unique values
            const gamesSnapshot = [...gamesSnapshotByCentre.docs, ...gamesSnapshotByPlaceId.docs].reduce((acc, cur) => {
                if (!acc.find(doc => doc.id === cur.id)) {
                    acc.push(cur);
                }
                return acc;
            }, []);

            // Filter the list on field attendees is set and not empty
            const filteredGamesSnapshot = gamesSnapshot.filter(doc => doc.data().attendees && doc.data().attendees.length > 0);

            // Initialize players set to ensure uniqueness
            const playersSet = new Set();

            // Initialize games set for organized_since_1st
            const organizedGamesSet = new Set();

            // Initialize games set for played_since_1st
            const playedGamesSet = new Set();

            // Iterate through gamesSnapshot items to populate playersSet and organizedGamesSet
            gamesSnapshot.forEach(doc => {
                // console.log(`Processing game: ${doc.id}`);
                const attendees = doc.data().attendees || [];
                const organizer = doc.data().organizer;
                const date = doc.data().date ? doc.data().date.toDate() : null; // Check if date exists

                if (date && organizer === userRef.id && date > getFirstDayOfMonth() && date <= getCurrentDate()) {
                    organizedGamesSet.add(doc.id);
                    if (doc.data().status === 'played') {
                        playedGamesSet.add(doc.id);
                    }
                }

                attendees.forEach(playerRef => {
                    if (playerRef && playerRef.id) {
                        playersSet.add(playerRef.id);
                    }
                });
            });

            // Convert sets to arrays
            const playersList = Array.from(playersSet);
            const organizedGamesList = Array.from(organizedGamesSet);
            const playedGamesList = Array.from(playedGamesSet);

            const playersCount = playersList.length;
            console.log(`Processed ${playersCount} players for user: ${userDoc.data().display_name}`);

            const organizedGamesCount = organizedGamesList.length;
            console.log(`Processed ${organizedGamesCount} organized games for user: ${userDoc.data().display_name}`);

            const playedGamesCount = playedGamesList.length;
            console.log(`Processed ${playedGamesCount} played games for user: ${userDoc.data().display_name}`);

            // Revenue calculation
            let totalRevenue = 0;
            playedGamesList.forEach(gameId => {
                const gameDoc = filteredGamesSnapshot.find(doc => doc.id === gameId);
                const maxPlayers = gameDoc.data().max_players || 0;
                const price = gameDoc.data().price || 0;
                totalRevenue += maxPlayers * price;
            });

            console.log(`Total revenue for user ${userDoc.data().display_name} since 1st of month: ${totalRevenue}`);

            // Populate followers
            let followersCount = 0;
            const usersSnapshot = await db.collection('users').where('centres_filter', '==', true).get();
            usersSnapshot.forEach(user => {
                const favouriteCentres = user.data().favorite_centres || [];
                favouriteCentres.forEach(centre => {
                    if (centre.centre === userDoc.data().display_name || centre.placeId === userDoc.data().centre_place_id) {
                        followersCount++;
                    }
                });
            });

            console.log(`Processed ${followersCount} followers for user: ${userDoc.data().display_name}`);

            // Check if pro_metrics document exists
            const proMetricsRef = db.collection('pro_metrics').where('user', '==', userRef);
            const proMetricsSnapshot = await proMetricsRef.get();

            let proMetricsDoc;
            if (proMetricsSnapshot.empty) {
                // If no document, create a new document in pro_metrics
                proMetricsDoc = db.collection('pro_metrics').doc();
            } else {
                // If document exists, take the existing doc
                proMetricsDoc = proMetricsSnapshot.docs[0].ref;
            }

            // Create or update pro_metrics document
            const now = admin.firestore.FieldValue.serverTimestamp();
            await proMetricsDoc.set({
                user: userRef,
                last_edited: now,
                players: playersCount,
                followers: followersCount,
                organized_since_1st: organizedGamesCount,
                played_since_1st: playedGamesCount,
                revenue_since_1st: totalRevenue
            }, { merge: true });

            console.log(`Updated pro_metrics for user: ${userRef.id}`);
        }

        console.log('Pro Metrics updated successfully');
    } catch (error) {
        console.error('Error updating Pro Metrics:', error);
    }
}

// Define getCurrentDate() to return the current date
function getCurrentDate() {
    return new Date();
}

// Define getFirstDayOfMonth() to return the first day of the current month
function getFirstDayOfMonth() {
    const currentDate = getCurrentDate();
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
}

// Usage:
updateProMetrics();
