const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const TARGET_UID = 'n3R2uzshLmftuthw5S5G7k14amb2';
const PHONE = '+33768250745';
const EMAIL = 'balboa.meteore0n@icloud.com';
const APPLE_EMAIL = 'fg66pkkmd8@privaterelay.appleid.com';
const HASH_PIC = 'LlDAW0s:aeoetpocf5azNOWDofa#';
const PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/users%2Fn3R2uzshLmftuthw5S5G7k14amb2%2Fuploads%2F1746287417901404.jpg?alt=media&token=ba44ef6d-0686-4ecd-9691-c0b4e9acdd11';
const NAMES = ['Carter', 'Nox', 'Norman', 'Dray'];

function summarize(d, id) {
    return {
        uid: id,
        display_name: d.display_name,
        nickname: d.nickname,
        first_name: d.first_name,
        last_name: d.last_name,
        email: d.email,
        phone: d.phone_number,
        banned: d.banned,
        created: d.created_time ? d.created_time.toDate().toISOString() : null,
        last_activity: d.last_activity_date ? d.last_activity_date.toDate().toISOString() : null,
        hash_pic: d.hash_pic,
        photo_url: d.photo_url,
    };
}

async function queryEqual(field, value, label) {
    if (!value) return [];
    const snap = await db.collection('users').where(field, '==', value).get();
    const results = [];
    snap.forEach(doc => {
        if (doc.id === TARGET_UID) return;
        results.push(summarize(doc.data(), doc.id));
    });
    if (results.length) {
        console.log(`\n=== Match on ${label} (${field}=${value}): ${results.length} other account(s) ===`);
        results.forEach(r => console.log(JSON.stringify(r, null, 2)));
    } else {
        console.log(`No other account on ${label}.`);
    }
    return results;
}

async function main() {
    const seen = new Set([TARGET_UID]);
    const all = [];

    const collect = async (field, value, label) => {
        const list = await queryEqual(field, value, label);
        for (const r of list) {
            if (!seen.has(r.uid)) {
                seen.add(r.uid);
                all.push(r);
            }
        }
    };

    await collect('phone_number', PHONE, 'phone');
    await collect('email', EMAIL, 'firestore email');
    await collect('email', APPLE_EMAIL, 'apple email');
    await collect('hash_pic', HASH_PIC, 'profile picture hash');
    await collect('photo_url', PHOTO_URL, 'exact photo URL');

    // Name-based heuristic scan: scan all users matching display_name
    for (const name of NAMES) {
        const snap = await db.collection('users').where('display_name', '==', name).get();
        const matches = [];
        snap.forEach(doc => {
            if (doc.id === TARGET_UID) return;
            matches.push(summarize(doc.data(), doc.id));
        });
        if (matches.length) {
            console.log(`\n=== display_name == "${name}": ${matches.length} account(s) ===`);
            matches.forEach(r => console.log(JSON.stringify(r, null, 2)));
        }
        const snap2 = await db.collection('users').where('nickname', '==', name).get();
        const matches2 = [];
        snap2.forEach(doc => {
            if (doc.id === TARGET_UID) return;
            matches2.push(summarize(doc.data(), doc.id));
        });
        if (matches2.length) {
            console.log(`\n=== nickname == "${name}": ${matches2.length} account(s) ===`);
            matches2.forEach(r => console.log(JSON.stringify(r, null, 2)));
        }
    }

    console.log(`\n\n=== SUMMARY ===`);
    console.log(`Found ${all.length} unique related account(s) via strong identifiers (phone/email/photo).`);
    all.forEach(r => console.log(`  - ${r.uid}: ${r.display_name} (${r.email || r.phone}) banned=${r.banned}`));

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
