const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const TARGET = {
    centre: 'LE FIVE Colombes',
    placeId: 'ChIJtW2wgSxl5kcRW1N56-y8ETo'
};

// These are the sources we used to ADD LE FIVE Colombes
const SOURCE_MATCHES = [
    { centre: 'UrbanSoccer - Asnières' },
    { placeId: 'ChIJi5LkLT9v5kcRSlhScqEFNWs' },
    { centre: 'LE FIVE Bezons' },
    { placeId: 'ChIJ71Mv0Wpk5kcRg-H9x7L-dXo' },
    { centre: 'UrbanSoccer La Défense' },
    { placeId: 'ChIJh4rnfVhk5kcRV2Q-ZKdm8vA' },
];

function matchesSource(place) {
    return SOURCE_MATCHES.some(source => {
        if (source.centre && place.centre === source.centre) return true;
        if (source.placeId && place.placeId === source.placeId) return true;
        return false;
    });
}

(async () => {
    const alertsSnap = await db.collection('alerts').get();
    let count = 0;

    for (const doc of alertsSnap.docs) {
        const data = doc.data();
        const { places = [], user } = data;

        const hasTarget = places.some(p => p.centre === TARGET.centre || p.placeId === TARGET.placeId);
        const hasSourceMatch = places.some(p => matchesSource(p));

        // Find alerts that HAVE LE FIVE Colombes but DON'T match any source criteria
        // These are the ones that already had it before our script
        if (hasTarget && !hasSourceMatch) {
            count++;
            const userDoc = await user.get();
            const userData = userDoc.exists ? userDoc.data() : {};
            console.log('---');
            console.log('Alert ID:', doc.id);
            console.log('User:', userData.display_name || user.id);
            console.log('Places:', places.map(p => p.centre).join(', '));
        }
    }

    console.log('\n=== Total:', count, '===');
    process.exit(0);
})();
