const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const firestore = admin.firestore();

async function updateLastMessengerForProUsers() {
    try {
        const userLastMessenger = {};

        const messengerSnapshot = await firestore.collection('messenger').get();

        messengerSnapshot.forEach((doc) => {
            console.log('Processing messenger document:', doc.id);
            const messengerData = doc.data();
            const conversationWithRef = messengerData.conversation_with; // Assuming 'conversation_with' is a DocumentReference
            const sentAt = messengerData.sent_at;

            if (conversationWithRef) {
                const userId = conversationWithRef.id;
                console.log('Conversation with user:', userId, 'at time:', sentAt);

                if (!userLastMessenger[userId] || sentAt > userLastMessenger[userId]) {
                    userLastMessenger[userId] = sentAt;
                    console.log('Updated latest messenger for user:', userId, 'with timestamp:', sentAt);
                }
            } else {
                console.log('Conversation with field not found in messenger document:', doc.id);
            }
        });

        console.log('User Last Messenger:', userLastMessenger);
        console.log('Updating last_messenger for users...');

        const updateTasks = Object.keys(userLastMessenger).map((userId) => {
            const sentAt = userLastMessenger[userId];
            const userRef = firestore.doc(`users/${userId}`);
            return userRef.update({
                last_messenger: sentAt
            });
        });

        await Promise.all(updateTasks);
        console.log('Updated last_messenger for all users.');
    } catch (error) {
        console.error('Error updating last_messenger:', error);
    }
}

updateLastMessengerForProUsers();
