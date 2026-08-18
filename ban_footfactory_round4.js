const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const DRY_RUN = process.env.EXECUTE !== '1';

// Round 3 of the FootFactory operator (see incident_footfactory_spammer.md).
// Same phone +33680464480 as rounds 1 & 2; "74"/"roussel" email theme. Created 2026-06-12
// (the day round 2 was banned). Off-platform SMS/payment-link funnel.
const UIDS = ['QnN56ssiMjMLIU2kbF7vBHGeEf93']; // "Antoine" / rousselcharles74@gmail.com
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

        // Delete all chat messages (pure spam/funnel, no legit content).
        const snap = await db.collection('messages').where('author_id', '==', userRef).get();
        const chat = snap.docs.filter(d => d.data().type === 'message' || (!d.data().type && !d.data().trigger && (d.data().text || '').trim()));
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
