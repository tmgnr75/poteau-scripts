const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: 'krank-club'
    });
}

const db = admin.firestore();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testPhoton() {
    // 1. Get placeIds NOT in cached_centres
    const cachedSnap = await db.collection('cached_centres').get();
    const cachedIds = new Set();
    cachedSnap.forEach(doc => cachedIds.add(doc.id));

    // Collect missing placeIds with names and counts
    const alertsSnap = await db.collection('alerts').get();
    const missing = new Map();
    alertsSnap.forEach(doc => {
        (doc.data().places || []).forEach(p => {
            if (p.placeId && !cachedIds.has(p.placeId)) {
                const ex = missing.get(p.placeId) || { name: p.centre, count: 0 };
                ex.count++;
                missing.set(p.placeId, ex);
            }
        });
    });

    // Pick 20: 10 most popular + 10 random from tail
    const sorted = [...missing.entries()].sort((a, b) => b[1].count - a[1].count);
    const top10 = sorted.slice(0, 10);
    const tail = sorted.filter(e => e[1].count <= 3);
    const random10 = [];
    const used = new Set();
    while (random10.length < 10 && random10.length < tail.length) {
        const idx = Math.floor(Math.random() * tail.length);
        if (!used.has(idx)) {
            used.add(idx);
            random10.push(tail[idx]);
        }
    }

    const testCases = [...top10, ...random10];

    console.log(`Testing Photon on ${testCases.length} centre names...\n`);

    let highConf = 0, medConf = 0, lowConf = 0, notFound = 0;

    for (const [placeId, info] of testCases) {
        const query = encodeURIComponent(info.name);
        const url = `https://photon.komoot.io/api/?q=${query}&limit=3`;

        try {
            const res = await fetch(url);
            const json = await res.json();
            const features = json.features || [];

            console.log(`--- "${info.name}" (${info.count} alerts, placeId: ${placeId}) ---`);

            if (features.length === 0) {
                console.log(`  ❌ NOT FOUND`);
                notFound++;
            } else {
                const f = features[0];
                const props = f.properties || {};
                const [lng, lat] = f.geometry?.coordinates || [null, null];
                const resultName = props.name || '?';
                const city = props.city || props.county || '?';
                const country = props.country || '?';
                const street = props.street || '';
                const house = props.housenumber || '';
                const postcode = props.postcode || '';
                const type = props.type || props.osm_value || '?';

                // Confidence assessment
                const inputLower = info.name.toLowerCase();
                const resultLower = resultName.toLowerCase();
                let confidence;
                if (resultLower === inputLower || inputLower.includes(resultLower) || resultLower.includes(inputLower)) {
                    confidence = 'HIGH';
                    highConf++;
                } else if (city !== '?' && inputLower.includes(city.toLowerCase())) {
                    confidence = 'MEDIUM';
                    medConf++;
                } else {
                    confidence = 'LOW';
                    lowConf++;
                }

                console.log(`  ✅ Found: "${resultName}" (type: ${type})`);
                console.log(`     Location: ${lat}, ${lng}`);
                console.log(`     Address: ${[house, street, postcode, city].filter(Boolean).join(', ')}`);
                console.log(`     Country: ${country}`);
                console.log(`     Confidence: ${confidence}`);

                if (features.length > 1) {
                    const f2 = features[1];
                    const p2 = f2.properties || {};
                    console.log(`     Alt result: "${p2.name}" in ${p2.city || p2.county || '?'}, ${p2.country || '?'}`);
                }
            }
        } catch (err) {
            console.log(`--- "${info.name}" ---`);
            console.log(`  ⚠️ ERROR: ${err.message}`);
            notFound++;
        }

        await sleep(1100); // rate limit
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total tested: ${testCases.length}`);
    console.log(`HIGH confidence: ${highConf} (${(highConf / testCases.length * 100).toFixed(0)}%)`);
    console.log(`MEDIUM confidence: ${medConf} (${(medConf / testCases.length * 100).toFixed(0)}%)`);
    console.log(`LOW confidence: ${lowConf} (${(lowConf / testCases.length * 100).toFixed(0)}%)`);
    console.log(`NOT FOUND: ${notFound} (${(notFound / testCases.length * 100).toFixed(0)}%)`);
    console.log(`\nUsable (HIGH+MEDIUM): ${highConf + medConf} (${((highConf + medConf) / testCases.length * 100).toFixed(0)}%)`);

    process.exit(0);
}

testPhoton().catch(err => { console.error(err); process.exit(1); });
