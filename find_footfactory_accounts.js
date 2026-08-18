const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const MAIN = 'wXU8AnN70fhWnVWj3DbtIcfNGXK2';
const PHONE = '+33680464480';
const HASH_PIC = 'L39+MUpIti%K.ko|r{xtH[IU%LtR';
const PHOTO_URL = 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/users%2FwXU8AnN70fhWnVWj3DbtIcfNGXK2%2Fuploads%2F1774652649094009.jpg?alt=media&token=05f5bf2c-083c-4186-b59f-7e0d423ee41c';
const NAMES = ['Sport Pour Tous !', 'Sport Pour Tous', 'Antoine', 'FootFactory', 'Foot Factory', 'Tanguy'];

const sum = (d, id) => ({ uid: id, name: d.display_name, nickname: d.nickname, email: d.email, phone: d.phone_number, banned: d.banned, created: d.created_time?.toDate?.().toISOString(), last: d.last_activity_date?.toDate?.().toISOString(), hash_pic: d.hash_pic });

async function q(field, value) {
    if (!value) return [];
    const s = await db.collection('users').where(field, '==', value).get();
    return s.docs.map(d => sum(d.data(), d.id));
}

async function main() {
    const found = new Map();
    const add = (arr, via) => arr.forEach(r => { if (!found.has(r.uid)) { r.via = via; found.set(r.uid, r); } });

    add(await q('phone_number', PHONE), 'phone');
    add(await q('hash_pic', HASH_PIC), 'hash_pic');
    add(await q('photo_url', PHOTO_URL), 'photo_url');
    for (const n of NAMES) {
        add(await q('display_name', n), `name:${n}`);
        add(await q('nickname', n), `nick:${n}`);
    }

    console.log(`=== ${found.size} candidate accounts ===\n`);
    for (const r of found.values()) {
        let disabled = '?';
        try { disabled = (await admin.auth().getUser(r.uid)).disabled; } catch {}
        console.log(`${r.uid} | ${r.name} | ${r.email} | ${r.phone} | banned=${r.banned} | auth.disabled=${disabled} | via=${r.via}`);
        console.log(`   created=${r.created} last=${r.last}`);
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
