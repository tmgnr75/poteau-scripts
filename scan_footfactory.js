const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const SUSPECT_UID = 'wXU8AnN70fhWnVWj3DbtIcfNGXK2';
const SUSPECT_PHONE = '+33680464480';
const SUSPECT_EMAIL = 'assosportpourtous74@gmail.com';
// Keywords that signal off-platform redirection / competitor promo
const RX = /footfactory|foot factory|footfactory\.online|id6744173972|sport pour tous|inscription obligatoire|06\s*80\s*46\s*44\s*80|0680464480|gymnase|notre app|notre application|sur notre app/i;

function ts(v) { return v?.toDate ? v.toDate().toISOString() : null; }

async function main() {
    // 1. Scan recent chat messages for competitor/redirect keywords
    const snap = await db.collection('messages')
        .where('type', '==', 'message')
        .orderBy('created', 'desc')
        .limit(15000)
        .get();
    console.log(`Scanned ${snap.size} chat messages.\n`);

    const matches = [];
    snap.forEach(doc => {
        const d = doc.data();
        const text = `${d.text || ''} ${d.text_en || ''} ${d.text_es || ''} ${d.text_it || ''}`;
        if (RX.test(text)) {
            matches.push({
                id: doc.id,
                author_id: d.author_id?.id || null,
                author_name: d.author_name,
                game_id: d.game_id?.id || null,
                created: ts(d.created),
                text: (d.text || '').replace(/\n/g, ' '),
            });
        }
    });

    console.log(`=== ${matches.length} keyword matches ===`);
    const byAuthor = {};
    for (const m of matches) {
        const k = m.author_id || 'unknown';
        (byAuthor[k] = byAuthor[k] || { name: m.author_name, games: new Set(), msgs: [] });
        byAuthor[k].games.add(m.game_id);
        byAuthor[k].msgs.push(m);
    }
    for (const [uid, info] of Object.entries(byAuthor)) {
        console.log(`\n--- ${uid} (${info.name}) — ${info.msgs.length} msgs across ${info.games.size} games ---`);
        info.msgs.slice(0, 8).forEach(m => console.log(`  [${m.created}] game=${m.game_id}\n     "${m.text.slice(0, 180)}"`));
        if (info.msgs.length > 8) console.log(`  ...+${info.msgs.length - 8} more`);
    }

    // 2. All games organized by suspect
    console.log('\n\n======================================================');
    console.log('=== ALL GAMES BY SUSPECT', SUSPECT_UID, '===');
    console.log('======================================================');
    const games = await db.collection('games').where('organizer', '==', SUSPECT_UID).get();
    console.log(`Total games organized: ${games.size}`);
    const now = new Date();
    let upcoming = 0;
    games.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.date?.toDate?.() || 0) - (b.date?.toDate?.() || 0))
        .forEach(g => {
            const dt = g.date?.toDate?.();
            const future = dt && dt > now && g.status === 'published';
            if (future) upcoming++;
            console.log(`  ${g.id} | ${ts(g.date)} | status=${g.status} | ${g.centre} | ${g.address} | attendees=${(g.attendees || []).length}${future ? '  <== UPCOMING/PUBLISHED' : ''}`);
        });
    console.log(`\nUpcoming published: ${upcoming}`);

    // 3. Related accounts by phone/email
    console.log('\n======================================================');
    console.log('=== RELATED ACCOUNTS (phone/email match) ===');
    console.log('======================================================');
    for (const [field, val] of [['phone_number', SUSPECT_PHONE], ['email', SUSPECT_EMAIL]]) {
        const r = await db.collection('users').where(field, '==', val).get();
        console.log(`\n${field} == ${val}: ${r.size} account(s)`);
        r.forEach(d => {
            const u = d.data();
            console.log(`  - ${d.id} | ${u.display_name} | ${u.email} | ${u.phone_number} | banned=${u.banned}`);
        });
    }

    process.exit(0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
