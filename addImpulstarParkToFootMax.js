const admin = require('firebase-admin');
const readline = require("readline");
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club';

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: PROJECT_ID,
});

const db = admin.firestore();

const SOURCE_CENTRE = "Foot-Max Argenteuil";
const NEW_PLACE = {
    centre: "IMPULSTAR PARK",
    placeId: "impulstarpark"
};

// CLI helpers
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

(async () => {
    console.log("🚀 Starting alerts migration: adding IMPULSTAR PARK to relevant alerts...");

    const alertsSnap = await db.collection("alerts").get();
    console.log(`📂 Total alerts scanned: ${alertsSnap.size}`);

    let matched = 0;
    let alreadyHasImpulstar = 0;
    const toUpdate = [];

    for (const doc of alertsSnap.docs) {
        const data = doc.data();
        const { places = [] } = data;

        const hasFootMax = places.some(p => p.centre === SOURCE_CENTRE);
        const hasImpulstar = places.some(p => p.centre === NEW_PLACE.centre);

        if (hasFootMax) {
            if (hasImpulstar) {
                alreadyHasImpulstar++;
                continue; // no need to add again
            }
            matched++;
            toUpdate.push({ id: doc.id, ref: doc.ref, places });
        }
    }

    console.log("\n📊 Migration summary:");
    console.log(`   Alerts matched (contain ${SOURCE_CENTRE}): ${matched}`);
    console.log(`   Already had ${NEW_PLACE.centre}: ${alreadyHasImpulstar}`);
    console.log(`   To update (add new place): ${toUpdate.length}\n`);

    const answer = await askQuestion("👉 Proceed with updates? (y/n) ");
    if (answer.toLowerCase() !== "y") {
        console.log("⏩ Aborted. No documents updated.");
        rl.close();
        return;
    }

    // Batch updates
    console.log("🛠️ Updating alerts in batches of 400...");
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
        console.log(`✅ Batch committed (${updated}/${toUpdate.length})`);
    }

    console.log(`🎉 Finished. Updated ${updated} alerts with ${NEW_PLACE.centre}.`);
    rl.close();
})();