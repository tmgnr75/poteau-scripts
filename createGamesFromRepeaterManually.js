const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const { DateTime } = require('luxon');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createGamesFromRepeaterManually(repeaterId) {
    try {
        // Fetch the repeater document based on the ID
        const repeaterSnapshot = await db.collection('repeaters').doc(repeaterId).get();
        const repeaterData = repeaterSnapshot.data();

        if (!repeaterData) {
            console.error(`Repeater with ID ${repeaterId} not found.`);
            return;
        }

        // Get the user's ID from the organizer field
        const organizerUserId = repeaterData.organizer;

        // Fetch the user document based on the ID
        const userSnapshot = await db.collection('users').doc(organizerUserId).get();

        if (!userSnapshot.exists) {
            console.error(`User with ID ${organizerUserId} not found.`);
            return;
        }

        // Extract the user's time_zone from the user document
        const userTimeZone = userSnapshot.data().time_zone;

        // Convert time to the user's timezone using luxon
        const timeUtcPlus8 = DateTime.fromJSDate(repeaterData.time.toDate()).setZone('UTC+8');
        const timeInUserTimeZone = timeUtcPlus8.setZone(userTimeZone);

        // Update the repeater document with the expectedTime field
        await db.collection('repeaters').doc(repeaterId).update({
            timeZone: userTimeZone,
        });

        // Function to calculate the next occurrence of the specified weekday
        function getNextWeekdayDate(weekday, userTimeZone) {
            const currentDate = DateTime.now().setZone(userTimeZone);
            const currentDay = currentDate.weekday;
            const daysUntilNextWeekday = (weekday - currentDay + 7) % 7;
            return currentDate.plus({ days: daysUntilNextWeekday });
        }

        // Get the next occurrence date for the specified weekday
        const nextWeekdayDate = getNextWeekdayDate(repeaterData.weekday, userTimeZone);

        // Get the game start time using luxon and adjust it to the user's expected time
        const gameStartTime = DateTime.fromJSDate(repeaterData.time.toDate())
            .setZone(userTimeZone)
            .set({ hour: timeInUserTimeZone.hour, minute: timeInUserTimeZone.minute, second: 0, millisecond: 0 });

        const endDate = nextWeekdayDate.plus({ weeks: 3 });

        let upcomingDate = nextWeekdayDate;
        const gamesToCreate = [];

        while (upcomingDate <= endDate) {
            if (upcomingDate.weekday !== repeaterData.weekday) {
                upcomingDate = upcomingDate.plus({ days: (repeaterData.weekday - upcomingDate.weekday + 7) % 7 });
            }

            const gameTime = gameStartTime.set({ year: upcomingDate.year, month: upcomingDate.month, day: upcomingDate.day });

            // Create games based on gameTime
            const gamesQuery = db.collection('games')
                .where('date', '==', admin.firestore.Timestamp.fromDate(gameTime.toJSDate()))
                .where('duration', '==', repeaterData.duration)
                .where('max_players', '==', repeaterData.maxPlayers)
                .where('price', '==', repeaterData.price)
                .where('organizer', '==', organizerUserId)
                .where('address', '==', repeaterData.address)
                .where('location', '==', repeaterData.location)
                .where('centre', '==', repeaterData.centre)
                .where('place_id', '==', repeaterData.placeId)
                .where('status', '==', repeaterData.status);

            const gamesSnapshot = await gamesQuery.get();

            if (gamesSnapshot.empty) {
                const gameData = {
                    date: admin.firestore.Timestamp.fromDate(gameTime.toJSDate()),
                    end_time: gameTime.plus({ minutes: repeaterData.duration }).toJSDate(),
                    duration: repeaterData.duration,
                    max_players: repeaterData.maxPlayers,
                    price: repeaterData.price,
                    organizer: organizerUserId,
                    address: repeaterData.address,
                    location: repeaterData.location,
                    centre: repeaterData.centre,
                    place_id: repeaterData.placeId,
                    status: 'published',
                    type: 'pro',
                    repeater: db.collection('repeaters').doc(repeaterId),
                };

                gamesToCreate.push(gameData);
            }

            upcomingDate = upcomingDate.plus({ weeks: 1 });
        }

        if (gamesToCreate.length > 0) {
            const batch = db.batch();

            gamesToCreate.forEach((gameData) => {
                const newGameRef = db.collection('games').doc();
                batch.set(newGameRef, gameData);
                console.log('New game created with ID:', newGameRef.id);
            });

            await batch.commit();
        }

        console.log(`Games created successfully for repeater ID: ${repeaterId}`);
    } catch (error) {
        console.error(`Error creating games for repeater ID ${repeaterId}:`, error);
    }
}

// Manual trigger example
const repeaterIds = [
    '14MvhX6TF6N9oOKRqFzj',
    '1zGCYvHIvQDkO1MGMzTW',
    'ANiESDGBPEZ9xfTd1xmK',
    'EOwEvYMKJkgoyWnDMwl5',
    'H2Jhu36dZM8pxf3tJVnK',
    'YuSzspUCS6Go2oFOtDP5',
    'sI72yi9cQOAXm63W7mPp'
];
repeaterIds.forEach(repeaterId => createGamesFromRepeaterManually(repeaterId));
