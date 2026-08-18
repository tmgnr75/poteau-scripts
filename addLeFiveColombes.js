const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Source centres/placeIds to match
const SOURCE_MATCHES = [
    { centre: "UrbanSoccer - Asnières" },
    { placeId: "ChIJi5LkLT9v5kcRSlhScqEFNWs" },
    { centre: "LE FIVE Bezons" },
    { placeId: "ChIJ71Mv0Wpk5kcRg-H9x7L-dXo" },
    { centre: "UrbanSoccer La Défense" },
    { placeId: "ChIJh4rnfVhk5kcRV2Q-ZKdm8vA" },
];

// New place to add
const NEW_PLACE = {
    centre: "LE FIVE Colombes",
    placeId: "ChIJtW2wgSxl5kcRW1N56-y8ETo"
};

// CLI helpers
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

// Check if a place matches any of our source criteria
function matchesSource(place) {
    return SOURCE_MATCHES.some(source => {
        if (source.centre && place.centre === source.centre) return true;
        if (source.placeId && place.placeId === source.placeId) return true;
        return false;
    });
}

(async () => {
    console.log("Starting alerts migration: adding LE FIVE Colombes to relevant alerts...");

    const alertsSnap = await db.collection("alerts").get();
    console.log(`Total alerts scanned: ${alertsSnap.size}`);

    let matched = 0;
    let alreadyHasTarget = 0;
    const toUpdate = [];

    for (const doc of alertsSnap.docs) {
        const data = doc.data();
        const { places = [] } = data;

        // Check if any place matches our source criteria
        const hasSourceMatch = places.some(p => matchesSource(p));

        // Check if already has the target place
        const hasTarget = places.some(p =>
            p.centre === NEW_PLACE.centre || p.placeId === NEW_PLACE.placeId
        );

        if (hasSourceMatch) {
            if (hasTarget) {
                alreadyHasTarget++;
                continue; // no need to add again
            }
            matched++;
            toUpdate.push({ id: doc.id, ref: doc.ref, places });
        }
    }

    console.log("\nMigration summary:");
    console.log(`   Alerts matched (contain any source centre/placeId): ${matched}`);
    console.log(`   Already had ${NEW_PLACE.centre}: ${alreadyHasTarget}`);
    console.log(`   To update (add new place): ${toUpdate.length}\n`);

    if (toUpdate.length === 0) {
        console.log("No alerts to update. Exiting.");
        rl.close();
        return;
    }

    // Check if running with --yes flag to skip confirmation
    const skipConfirmation = process.argv.includes('--yes');

    if (!skipConfirmation) {
        const answer = await askQuestion("Proceed with updates? (y/n) ");
        if (answer.toLowerCase() !== "y") {
            console.log("Aborted. No documents updated.");
            rl.close();
            return;
        }
    } else {
        console.log("Running with --yes flag, skipping confirmation...");
    }

    // Batch updates
    console.log("Updating alerts in batches of 400...");
    const batchSize = 400;
    let updated = 0;

    for (let i = 0; i < toUpdate.length; i += batchSize) {
        const chunk = toUpdate.slice(i, i + batchSize);
        const batch = db.batch();

        for (const { ref, places } of chunk) {
            const newPlaces = [...places, NEW_PLACE];
            batch.update(ref, { places: newPlaces });
        }

        await batch.commit();
        updated += chunk.length;
        console.log(`Batch committed (${updated}/${toUpdate.length})`);
    }

    console.log(`Finished. Updated ${updated} alerts with ${NEW_PLACE.centre}.`);
    rl.close();
})();
