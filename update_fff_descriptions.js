const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

async function update_fff_description() {
    try {
        const now = admin.firestore.Timestamp.now();
        const appendText = ` - Viens jouer au foot sur les terrains de ce nouveau centre, lancé en partenariat avec la FFF ⚽️

Des matchs ouverts à tous, à petit prix pour rendre le foot accessible ! Et comme pour tous les matchs dont le paiement se fait sur l'app, la sécurité de ne payer que si le match se joue vraiment.

Si tu as des questions, n'hésite pas à les poser dans la discussion ci-dessous 👇`;

        const defaultDescription = `Viens jouer au foot sur les terrains de ce nouveau centre, lancé en partenariat avec la FFF ⚽️

Des matchs ouverts à tous, à petit prix pour rendre le foot accessible ! Et comme pour tous les matchs dont le paiement se fait sur l'app, la sécurité de ne payer que si le match se joue vraiment.

Si tu as des questions, n'hésite pas à les poser dans la discussion ci-dessous 👇`;

        // 1. Update "games" collection where date > now() and fff_game == true
        const gamesSnapshot = await db.collection('games')
            .where('date', '>', now)
            .where('fff_game', '==', true)
            .get();

        if (!gamesSnapshot.empty) {
            const gamesBatch = db.batch();
            let gamesCount = 0;

            gamesSnapshot.forEach(doc => {
                const data = doc.data();
                const docRef = doc.ref;

                let updatedDescription = data.description || '';
                if (updatedDescription.trim()) {
                    // If description is set and not empty, append text
                    updatedDescription += ` ${appendText}`;
                } else {
                    // If no description, set default
                    updatedDescription = defaultDescription;
                }

                gamesBatch.update(docRef, { description: updatedDescription });
                gamesCount++;
            });

            await gamesBatch.commit();
            console.log(`Updated ${gamesCount} games documents with FFF description.`);
        } else {
            console.log('No matching games documents found.');
        }

        // 2. Update "repeaters" collection where organizer matches
        const repeatersSnapshot = await db.collection('repeaters')
            .where('organizer', 'in', [
                'GawiMoMDqAN8oh8ZWzlAnZ1Ldj12',
                'ioHEl8ayn0S34tjLwuRpR0nkU103',
                'uSeJPOhAaJVUPyU4ATMg8oaYeRG3'
            ])
            .get();

        if (!repeatersSnapshot.empty) {
            const repeatersBatch = db.batch();
            let repeatersCount = 0;

            repeatersSnapshot.forEach(doc => {
                const data = doc.data();
                const docRef = doc.ref;

                let updatedDescription = data.description || '';
                if (updatedDescription.trim()) {
                    // If description is set and not empty, append text
                    updatedDescription += ` ${appendText}`;
                } else {
                    // If no description, set default
                    updatedDescription = defaultDescription;
                }

                repeatersBatch.update(docRef, { description: updatedDescription });
                repeatersCount++;
            });

            await repeatersBatch.commit();
            console.log(`Updated ${repeatersCount} repeaters documents with FFF description.`);
        } else {
            console.log('No matching repeaters documents found.');
        }

    } catch (error) {
        console.error('Error during description update process:', error);
    }
}

update_fff_description().then(() => {
    console.log('Description update process completed for both games and repeaters collections.');
}).catch(error => {
    console.error('An error occurred during the update process:', error);
});