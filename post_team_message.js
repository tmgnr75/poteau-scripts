const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const GAME_ID = '3hS0xsLDnkYKYSUB2p99';

async function main() {
    const gameRef = db.collection('games').doc(GAME_ID);

    const messageData = {
        type: 'poteau_team_message',
        game_id: gameRef,
        created: admin.firestore.FieldValue.serverTimestamp(),
        text: "Nous présentons nos excuses pour les messages inappropriés publiés sur ce match. L'utilisateur en question a été banni de la plateforme. Poteau est un espace de sport et de respect — ce type de comportement n'a pas sa place ici. Merci pour votre compréhension.",
        text_en: "We apologize for the inappropriate messages posted on this game. The user has been banned from the platform. Poteau is a space for sport and respect — this kind of behavior has no place here. Thank you for your understanding.",
        text_es: "Pedimos disculpas por los mensajes inapropiados publicados en este partido. El usuario ha sido baneado de la plataforma. Poteau es un espacio de deporte y respeto — este tipo de comportamiento no tiene cabida aquí. Gracias por su comprensión.",
        text_it: "Ci scusiamo per i messaggi inappropriati pubblicati su questa partita. L'utente è stato bannato dalla piattaforma. Poteau è uno spazio di sport e rispetto — questo tipo di comportamento non ha posto qui. Grazie per la comprensione.",
        author_name: "Poteau",
        author_picture: "",
        author_id: null,
    };

    const docRef = await db.collection('messages').add(messageData);
    console.log(`Message posted with ID: ${docRef.id}`);

    // Add message reference to game document
    const gameDoc = await gameRef.get();
    if (gameDoc.exists) {
        const currentMessages = gameDoc.data().messages || [];
        currentMessages.push(docRef);
        await gameRef.update({ messages: currentMessages });
        console.log('Message reference added to game document.');
    }

    console.log('Done!');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
