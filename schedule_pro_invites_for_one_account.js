const admin = require('firebase-admin');
const moment = require('moment-timezone');
const geoTz = require('geo-tz');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

async function scheduleProInvitesForOneAccount() {
    try {
        const now = moment();
        const eightDaysLater = now.clone().add(8, 'days').endOf('day');
        const userId = 'CtMIzMx3atVuH1nKNOJj6lNQL4A2';

        // Define the time range for games
        const rangeStart = admin.firestore.Timestamp.fromDate(now.toDate());
        const rangeEnd = admin.firestore.Timestamp.fromDate(eightDaysLater.toDate());

        console.log('Processing games between:', rangeStart.toDate(), 'and', rangeEnd.toDate());

        const gamesQuerySnapshot = await admin.firestore().collection('games')
            .where('organizer', '==', userId)
            .where('type', '==', 'pro')
            .where('date', '>=', rangeStart)
            .where('date', '<=', rangeEnd)
            .get();

        if (gamesQuerySnapshot.empty) {
            console.log('There are no Pro games scheduled in the next 8 days.');
            return;
        }

        let allInvitations = [];

        for (const gameDoc of gamesQuerySnapshot.docs) {
            const gameData = gameDoc.data();
            const gameId = gameDoc.id;
            console.log(`Processing game ID: ${gameId}`);

            const timeZones = geoTz.find(gameData.location.latitude, gameData.location.longitude);
            const timeZone = timeZones.length > 0 ? timeZones[0] : 'CET';
            const gameDateAdjusted = moment(gameData.date.toDate()).tz(timeZone);

            console.log('Time Zone:', timeZone);
            console.log('Game Date Adjusted:', gameDateAdjusted.format());

            const attendeesSnapshot = await gameDoc.ref.collection('attendees').get();
            const attendees = attendeesSnapshot.docs.map(doc => doc.data().user);

            const alertsQuerySnapshot = await admin.firestore().collection('alerts')
                .where('times', 'array-contains', gameDateAdjusted.format('HH:mm'))
                .get();

            let matchingAlertsIds = [];
            alertsQuerySnapshot.forEach(alertDoc => {
                const alertData = alertDoc.data();
                const weekdays = alertData.weekdays || [];
                const places = alertData.places || [];
                if (weekdays.includes(gameDateAdjusted.day())) {
                    places.forEach(place => {
                        if ((gameData.place_id && place.placeId === gameData.place_id) ||
                            (gameData.centre && place.centre === gameData.centre)) {
                            matchingAlertsIds.push(alertDoc.id);
                        }
                    });
                }
            });

            console.log('Matching Alerts:', matchingAlertsIds);

            let invites = [];
            if (matchingAlertsIds.length > 0) {
                const alertsPromises = matchingAlertsIds.map(alertId => admin.firestore().collection('alerts').doc(alertId).get());

                const alertsDocs = await Promise.all(alertsPromises);

                alertsDocs.forEach(alertDoc => {
                    const alertData = alertDoc.data();
                    const inviteeRef = alertData.user;

                    if (!attendees.includes(inviteeRef.id)) {
                        invites.push({
                            inviter: admin.firestore().doc('users/Team-App'),
                            invitee: inviteeRef,
                            game: gameDoc.ref,
                            source: 'alerts',
                            status: 'pending',
                            alert: alertDoc.ref,
                            created: admin.firestore.FieldValue.serverTimestamp(),
                        });
                    }
                });
            }

            console.log('Invites to be created for game ID:', gameId, invites.length);
            allInvitations = allInvitations.concat(invites);
        }

        if (allInvitations.length > 0) {
            const createInvitationsPromises = allInvitations.map(invite => admin.firestore().collection('game_invitations').add(invite));
            await Promise.all(createInvitationsPromises);
            console.log('Created all game invitations.');
        } else {
            console.log('No invites to be created.');
        }

    } catch (error) {
        console.error('Error scheduling pro game invitations:', error);
    }
}

scheduleProInvitesForOneAccount();