const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const DRY_RUN = process.env.EXECUTE !== '1';

// Collectif Football Associatif — external amateur club using Poteau as a free recruiting
// channel + mandatory WhatsApp funnel ("sinon vous ne pourrez pas jouer"). Platform abuse.
const UIDS = ['CIxO5DIQUESDkuFDrpdgNLjQtE93'];
const ts = v => v?.toDate ? v.toDate().toISOString() : null;

async function main() {
    console.log(DRY_RUN ? '======= DRY RUN (no writes) =======\n' : '======= EXECUTING =======\n');
    const now = new Date();
    for (const uid of UIDS) {
        console.log(`\n================ ${uid} ================`);
        const userRef = db.collection('users').doc(uid);

        if (DRY_RUN) {
            console.log('WOULD set Firestore banned=true + Auth disabled=true');
        } else {
            await userRef.update({ banned: true });
            console.log('✅ Firestore: banned=true');
            try { await admin.auth().updateUser(uid, { disabled: true }); console.log('✅ Auth: disabled=true'); }
            catch (e) { console.log('⚠️  Auth disable failed:', e.message); }
        }

        // Delete all chat messages (pure recruiting/funnel content, no legit player chatter).
        const snap = await db.collection('messages').where('author_id', '==', userRef).get();
        const chat = snap.docs.filter(d => d.data().type === 'message');
        console.log(`Chat messages to delete: ${chat.length} (of ${snap.size} authored)`);
        if (!DRY_RUN && chat.length) {
            const byGame = {};
            for (const d of chat) { const gid = d.data().game_id?.id; if (gid) (byGame[gid] = byGame[gid] || []).push(d.id); }
            let batch = db.batch(), n = 0, total = 0;
            for (const d of chat) { batch.delete(d.ref); if (++n >= 450) { await batch.commit(); total += n; batch = db.batch(); n = 0; } }
            if (n) { await batch.commit(); total += n; }
            console.log(`✅ Deleted ${total} messages.`);
            let gu = 0;
            for (const [gid, ids] of Object.entries(byGame)) {
                const gd = await db.collection('games').doc(gid).get();
                if (!gd.exists) continue;
                const cur = gd.data().messages || [];
                const filt = cur.filter(r => !ids.includes(r.id));
                if (filt.length !== cur.length) { await db.collection('games').doc(gid).update({ messages: filt }); gu++; }
            }
            if (gu) console.log(`✅ Scrubbed message refs on ${gu} game docs.`);
        }

        // Cancel upcoming published games.
        const games = await db.collection('games').where('organizer', '==', uid).where('status', '==', 'published').get();
        const upcoming = games.docs.filter(d => d.data().date?.toDate?.() > now);
        console.log(`Upcoming published games to cancel: ${upcoming.length}`);
        upcoming.forEach(d => console.log(`   - ${d.id} | ${ts(d.data().date)} | ${d.data().centre} | att=${(d.data().attendees || []).length}`));
        if (!DRY_RUN && upcoming.length) {
            let batch = db.batch();
            for (const d of upcoming) batch.update(d.ref, { status: 'canceled' });
            await batch.commit();
            console.log(`✅ Canceled ${upcoming.length} games.`);
        }
    }
    console.log(`\n=== ${DRY_RUN ? 'DRY RUN COMPLETE — re-run with EXECUTE=1' : 'DONE'} ===`);
    process.exit(0);
}
main().catch(e => { console.error('Error:', e); process.exit(1); });
