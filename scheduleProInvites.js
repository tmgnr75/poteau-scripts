const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();
const moment = require('moment-timezone');

console.log(`[${new Date().toISOString()}] 🔄 Script started: Scheduling Pro game invitations for Sunday, March 9, 2025.`);

async function isUserAlreadyInvited(userRef, gameRef) {
    console.log(`🔍 Checking if user ${userRef.id} is already invited to game ${gameRef.id}...`);
    
    const existingInvitesQuery = await db.collection('game_invitations')
        .where('invitee', '==', userRef)
        .where('game', '==', gameRef)
        .limit(1)
        .get();

    return !existingInvitesQuery.empty;
}

async function scheduleProInvites() {
    try {
        const targetDate = moment.tz('2025-03-09', 'Europe/Paris').startOf('day');
        console.log(`[${new Date().toISOString()}] 📅 Processing Pro games scheduled on: ${targetDate.format('YYYY-MM-DD')}`);

        const gamesQuerySnapshot = await db.collection('games')
            .where('type', '==', 'pro')
            .where('date', '>=', admin.firestore.Timestamp.fromDate(targetDate.toDate()))
            .where('date', '<', admin.firestore.Timestamp.fromDate(targetDate.clone().add(1, 'day').toDate()))
            .get();

        if (gamesQuerySnapshot.empty) {
            console.log(`[${new Date().toISOString()}] ❌ No Pro games found for March 9, 2025.`);
            return;
        }

        let allInvitations = [];

        for (const gameDoc of gamesQuerySnapshot.docs) {
            const gameData = gameDoc.data();
            const gameId = gameDoc.id;
            console.log(`🎮 Processing Game ID: ${gameId}, scheduled for ${moment(gameData.date.toDate()).format()}`);

            // Use time_zone directly from the game document
            const timeZone = gameData.time_zone || 'Europe/Paris';
            const gameDateAdjusted = moment(gameData.date.toDate()).tz(timeZone);

            console.log(`🌍 Time Zone from Firestore: ${timeZone}`);
            console.log(`🕒 Game Local Time: ${gameDateAdjusted.format('YYYY-MM-DD HH:mm')}`);

            // Fetch attendees
            const attendeesSnapshot = await gameDoc.ref.collection('attendees').get();
            const attendees = attendeesSnapshot.docs.map(doc => doc.data().user);
            console.log(`👥 Game ID: ${gameId} has ${attendees.length} attendees.`);

            // Retrieve alerts that match the game's time
            const alertsQuerySnapshot = await db.collection('alerts')
                .where('times', 'array-contains', gameDateAdjusted.format('HH:mm'))
                .get();

            let matchingAlertsIds = [];
            alertsQuerySnapshot.forEach(alertDoc => {
                const alertData = alertDoc.data();
                const weekdays = alertData.weekdays || [];
                const places = alertData.places || [];

                if (weekdays.includes(gameDateAdjusted.isoWeekday())) {
                    places.forEach(place => {
                        if ((gameData.place_id && place.placeId === gameData.place_id) ||
                            (gameData.centre && place.centre === gameData.centre)) {
                            matchingAlertsIds.push(alertDoc.id);
                        }
                    });
                }
            });

            console.log(`🔔 Found ${matchingAlertsIds.length} matching alerts for Game ID: ${gameId}.`);

            let invitedUsersSet = new Set();
            let invites = [];

            if (matchingAlertsIds.length > 0) {
                const alertsPromises = matchingAlertsIds.map(alertId => db.collection('alerts').doc(alertId).get());
                const alertsDocs = await Promise.all(alertsPromises);

                for (const alertDoc of alertsDocs) {
                    const alertData = alertDoc.data();
                    const inviteeRef = alertData.user;

                    // Check if user is already an attendee or already invited
                    if (!attendees.includes(inviteeRef.id) && !invitedUsersSet.has(inviteeRef.id)) {
                        const alreadyInvited = await isUserAlreadyInvited(inviteeRef, gameDoc.ref);

                        if (!alreadyInvited) {
                            invites.push({
                                inviter: db.doc('users/Team-App'),
                                invitee: inviteeRef,
                                game: gameDoc.ref,
                                source: 'alerts',
                                status: 'pending',
                                alert: alertDoc.ref,
                                created: admin.firestore.FieldValue.serverTimestamp(),
                                game_date: gameData.date || null
                            });
                            invitedUsersSet.add(inviteeRef.id);
                        }
                    }
                }
            }

            console.log(`📨 Game ID: ${gameId} will generate ${invites.length} new invitations.`);
            allInvitations = allInvitations.concat(invites);
        }

        if (allInvitations.length > 0) {
            console.log(`🚀 Creating ${allInvitations.length} game invitations...`);
            const createInvitationsPromises = allInvitations.map(invite => db.collection('game_invitations').add(invite));
            await Promise.all(createInvitationsPromises);
            console.log(`✅ Successfully created ${allInvitations.length} invitations.`);
        } else {
            console.log(`✅ No new invitations needed.`);
        }

    } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ ERROR:`, error);
    }
}

// Run the script
scheduleProInvites();