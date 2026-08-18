const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Titles and messages for different languages
const titleFr = "C'est la rentrée sur Poteau 🥅";
const messageFr = "Trouve des joueurs ou des matchs sur la meilleure appli pour jouer au foot autour de toi";

const titleEn = "Back-to-pitch period 🤓";
const messageEn = "Find players or games on the best app to play soccer near you";

// Function to send batch push notifications
const sendPushNotifications = async (users) => {
    const amplitudeEvents = [];

    console.log(`Starting to send push notifications to ${users.length} users in batches of 500...`);

    for (let i = 0; i < users.length; i += 500) {
        const batchUsers = users.slice(i, i + 500);
        console.log(`Processing batch ${i / 500 + 1} (users ${i + 1} to ${i + batchUsers.length})`);

        const batchPromises = batchUsers.map(async (user) => {
            const userRef = db.collection('users').doc(user.id);
            const userSnapshot = await userRef.get();
            const userData = userSnapshot.data();

            if (!userData) {
                console.log(`No data found for user with ID: ${user.id}`);
                return;
            }

            const language = userData.language || 'fr'; // Default to 'fr' if language is unset
            console.log(`User ID: ${user.id}, Language: ${language}`);

            let title, message;
            if (language === 'en') {
                title = titleEn;
                message = messageEn;
            } else {
                title = titleFr;
                message = messageFr;
            }

            // Retrieve FCM tokens
            const tokensSnapshot = await userRef.collection('fcm_tokens').get();
            const tokens = tokensSnapshot.docs.map(doc => doc.data().fcm_token);

            if (tokens.length === 0) {
                console.log(`No FCM tokens available for user with ID: ${user.id}`);
                return;
            }

            console.log(`Sending push notification to ${tokens.length} tokens for user ID: ${user.id}`);

            const pushMessage = {
                notification: {
                    title,
                    body: message,
                },
                tokens: tokens,
            };

            try {
                const response = await admin.messaging().sendMulticast(pushMessage);
                const successCount = response.successCount;
                const failureCount = response.failureCount;

                console.log(`Notifications sent to ${successCount} devices for user ID: ${user.id}`);
                if (failureCount > 0) {
                    console.error(`Failed to send ${failureCount} notifications out of ${tokens.length} tokens for user ID: ${user.id}`);
                }

                // Create Amplitude event
                const randomDeviceId = `backend_${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                amplitudeEvents.push({
                    event_type: 'Push received',
                    user_id: user.id,
                    device_id: randomDeviceId,
                    event_properties: {
                        title,
                        message,
                        type: 'back_to_school',
                    },
                });
            } catch (error) {
                console.error(`Error sending notifications for user ID: ${user.id}`, error);
            }
        });

        // Wait for batch to finish before continuing
        await Promise.all(batchPromises);

        console.log(`Batch ${i / 500 + 1} processing complete.`);

        if (amplitudeEvents.length > 0) {
            try {
                const amplitudeResponse = await sendAmplitudeEvents(amplitudeEvents);
                if (amplitudeResponse.status !== 200) {
                    throw new Error(`Amplitude batch upload failed: ${amplitudeResponse.statusText}`);
                }
                console.log(`Batch of ${amplitudeEvents.length} events sent to Amplitude.`);
            } catch (error) {
                console.error('Error sending batch to Amplitude:', error);
            }
        } else {
            console.log('No Amplitude events to send in this batch.');
        }
    }

    console.log('All push notifications have been sent.');
};

// Helper function to send events to Amplitude
const sendAmplitudeEvents = async (events) => {
    const axios = require('axios');
    return await axios.post('https://api2.amplitude.com/2/httpapi', {
        api_key: '57f03efbb1dfde7b97bb291b7eafa32f',
        events: events,
    });
};

// Main function to execute
const runPushNotifications = async () => {
    try {
        console.log('Fetching recipients from Firestore...');
        const recipientsSnapshot = await db.collection('users').get();
        const recipients = recipientsSnapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));

        console.log(`Found ${recipients.length} recipients.`);
        await sendPushNotifications(recipients);
    } catch (error) {
        console.error('Error sending push notifications:', error);
    }
};

runPushNotifications();