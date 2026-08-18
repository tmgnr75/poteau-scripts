const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

// Must have this (UrbanSoccer La Défense)
const MUST_HAVE = [
    { centre: "UrbanSoccer La Défense" },
    { placeId: "ChIJh4rnfVhk5kcRV2Q-ZKdm8vA" },
];

// Must NOT have any of these
const MUST_NOT_HAVE = [
    { centre: "UrbanSoccer - Asnières" },
    { placeId: "ChIJi5LkLT9v5kcRSlhScqEFNWs" },
    { centre: "LE FIVE Bezons" },
    { placeId: "ChIJ71Mv0Wpk5kcRg-H9x7L-dXo" },
];

// Place to remove
const PLACE_TO_REMOVE = {
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

// Check if places array contains any of the criteria
function hasAnyOf(places, criteria) {
    return criteria.some(c => {
        return places.some(p => {
            if (c.centre && p.centre === c.centre) return true;
            if (c.placeId && p.placeId === c.placeId) return true;
            return false;
        });
    });
}

// Check if places array contains the target place
function hasPlace(places, target) {
    return places.some(p =>
        p.centre === target.centre || p.placeId === target.placeId
    );
}

(async () => {
    console.log("Starting alerts cleanup: removing LE FIVE Colombes from specific alerts...");

    const alertsSnap = await db.collection("alerts").get();
    console.log(`Total alerts scanned: ${alertsSnap.size}`);

    let matched = 0;
    let doesNotHaveTarget = 0;
    const toUpdate = [];

    for (const doc of alertsSnap.docs) {
        const data = doc.data();
        const { places = [] } = data;

        // Check if has UrbanSoccer La Défense
        const hasMustHave = hasAnyOf(places, MUST_HAVE);

        // Check if has any of the excluded places
        const hasMustNotHave = hasAnyOf(places, MUST_NOT_HAVE);

        // Check if has LE FIVE Colombes
        const hasTarget = hasPlace(places, PLACE_TO_REMOVE);

        // Match: has La Défense, does NOT have Asnières/Bezons, and HAS LE FIVE Colombes
        if (hasMustHave && !hasMustNotHave) {
            if (!hasTarget) {
                doesNotHaveTarget++;
                continue; // nothing to remove
            }
            matched++;
            toUpdate.push({ id: doc.id, ref: doc.ref, places });
        }
    }

    console.log("\nCleanup summary:");
    console.log(`   Alerts with La Défense but without Asnières/Bezons: ${matched + doesNotHaveTarget}`);
    console.log(`   Already don't have ${PLACE_TO_REMOVE.centre}: ${doesNotHaveTarget}`);
    console.log(`   To update (remove place): ${toUpdate.length}\n`);

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
            // Remove LE FIVE Colombes from places array
            const newPlaces = places.filter(p =>
                p.centre !== PLACE_TO_REMOVE.centre && p.placeId !== PLACE_TO_REMOVE.placeId
            );
            batch.update(ref, { places: newPlaces });
        }

        await batch.commit();
        updated += chunk.length;
        console.log(`Batch committed (${updated}/${toUpdate.length})`);
    }

    console.log(`Finished. Removed ${PLACE_TO_REMOVE.centre} from ${updated} alerts.`);
    rl.close();
})();
