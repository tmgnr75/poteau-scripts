const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// Toggle: true = show what would happen, false = actually execute.
const DRY_RUN = process.env.EXECUTE !== '1';

// All 3 accounts confirmed as the FootFactory operator (shared phone / footfactory.net email / "74" theme).
const UIDS = [
    'wXU8AnN70fhWnVWj3DbtIcfNGXK2', // Sport Pour Tous ! (main, active, NOT yet banned)
    'WChWkRtCVQVILJyHDu4n5jsQ6FQ2', // Antoine (same phone +33680464480, Firestore-banned, Auth still on)
    'Bm1XJs3RTVcXHBKKX7m6ZI9O8JX2', // Sport Pour Tous ! / contact@footfactory.net (Firestore-banned, Auth still on)
];

// Content match: only delete messages that are clearly competitor-redirect / spam, NOT legit chatter.
const SPAM_RX = /footfactory|foot factory|footfactory\.online|footfactory\.net|id6744173972|notre app|notre application|sur l.?app|sur l.?application|inscription obligatoire|inscrit sur l|06\s*80\s*46\s*44\s*80|0680464480|valider votre place|paiement en ligne|lien (en ligne|dans (la|le) descript)|on recrute via|libère.*place|en ligne les gars/i;

const ts = v => v?.toDate ? v.toDate().toISOString() : null;

async function main() {
    console.log(DRY_RUN ? '======= DRY RUN (no writes) =======\n' : '======= EXECUTING (writing changes) =======\n');

    for (const uid of UIDS) {
        console.log(`\n================ ${uid} ================`);
        const userRef = db.collection('users').doc(uid);

        // --- 1. Ban (Firestore) + disable (Auth) ---
        if (DRY_RUN) {
            console.log('WOULD set Firestore banned=true');
            console.log('WOULD set Auth disabled=true');
        } else {
            await userRef.update({ banned: true });
            console.log('✅ Firestore: banned=true');
            try { await admin.auth().updateUser(uid, { disabled: true }); console.log('✅ Auth: disabled=true'); }
            catch (e) { console.log('⚠️  Auth disable failed:', e.message); }
        }

        // --- 2. Delete spam messages (content-matched) ---
        const snap = await db.collection('messages').where('author_id', '==', userRef).get();
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const spam = all.filter(m => m.type === 'message' && SPAM_RX.test(`${m.text || ''} ${m.text_en || ''}`));
        console.log(`Chat messages total: ${all.filter(m => m.type === 'message').length} | spam-matched: ${spam.length}`);
        spam.slice(0, 6).forEach(m => console.log(`   - [${ts(m.created)}] ${(m.text || '').replace(/\n/g, ' ').slice(0, 110)}`));
        if (spam.length > 6) console.log(`   ...+${spam.length - 6} more`);

        if (!DRY_RUN && spam.length) {
            // delete in batches + scrub game.messages refs
            const byGame = {};
            for (const m of spam) {
                const gid = m.game_id?.id;
                if (gid) (byGame[gid] = byGame[gid] || []).push(m.id);
            }
            let batch = db.batch(), n = 0, total = 0;
            for (const m of spam) {
                batch.delete(db.collection('messages').doc(m.id));
                if (++n >= 450) { await batch.commit(); total += n; batch = db.batch(); n = 0; }
            }
            if (n) { await batch.commit(); total += n; }
            console.log(`✅ Deleted ${total} spam messages.`);
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

        // --- 3. Cancel remaining published games ---
        const games = await db.collection('games').where('organizer', '==', uid).where('status', '==', 'published').get();
        console.log(`Published games to cancel: ${games.size}`);
        games.docs.forEach(d => console.log(`   - ${d.id} | ${ts(d.data().date)} | ${d.data().centre} | attendees=${(d.data().attendees || []).length}`));
        if (!DRY_RUN && games.size) {
            let batch = db.batch(), n = 0;
            for (const d of games.docs) {
                batch.update(d.ref, { status: 'canceled' });
                if (++n >= 450) { await batch.commit(); batch = db.batch(); n = 0; }
            }
            if (n) await batch.commit();
            console.log(`✅ Canceled ${games.size} published games.`);
        }
    }

    console.log(`\n=== ${DRY_RUN ? 'DRY RUN COMPLETE — re-run with EXECUTE=1 to apply' : 'DONE'} ===`);
    process.exit(0);
}
main().catch(e => { console.error('Error:', e); process.exit(1); });
