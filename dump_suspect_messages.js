const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const UIDS = ['wXU8AnN70fhWnVWj3DbtIcfNGXK2', 'WChWkRtCVQVILJyHDu4n5jsQ6FQ2'];
const ts = v => v?.toDate ? v.toDate().toISOString() : null;

async function main() {
    for (const uid of UIDS) {
        const ref = db.collection('users').doc(uid);
        const snap = await db.collection('messages')
            .where('author_id', '==', ref)
            .where('type', '==', 'message')
            .get();
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.created?.toDate?.() || 0) - (b.created?.toDate?.() || 0));
        console.log(`\n================ ${uid} — ${msgs.length} chat messages ================`);
        // Unique texts with counts
        const uniq = {};
        for (const m of msgs) {
            const t = (m.text || '').trim();
            uniq[t] = (uniq[t] || 0) + 1;
        }
        console.log(`--- ${Object.keys(uniq).length} distinct message texts ---`);
        Object.entries(uniq).sort((a, b) => b[1] - a[1]).forEach(([t, c]) => {
            console.log(`\n[x${c}] ${t.replace(/\n/g, ' ⏎ ')}`);
        });
    }
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
