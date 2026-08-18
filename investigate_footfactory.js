const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const GAME_ID = 'C2rLCbYg4SpSxZeHTDEI';

function refToId(ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return ref;
    if (ref.id) return ref.id;
    if (ref._path) return ref._path.segments.slice(-1)[0];
    return String(ref);
}

function ts(v) {
    if (!v) return null;
    if (v.toDate) return v.toDate().toISOString();
    if (v._seconds !== undefined) return new Date(v._seconds * 1000).toISOString();
    return v;
}

async function printUser(uid, label) {
    if (!uid) { console.log(`${label}: (none)`); return null; }
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { console.log(`${label}: user ${uid} not found`); return null; }
    const d = doc.data();
    console.log(`\n=== ${label} (${uid}) ===`);
    console.log('display_name:', d.display_name);
    console.log('first/last:', d.first_name, d.last_name, '| nickname:', d.nickname);
    console.log('email:', d.email);
    console.log('phone_number:', d.phone_number);
    console.log('type:', d.type, '| banned:', d.banned, '| gold:', d.gold_status);
    console.log('centre_name:', d.centre_name);
    console.log('country:', d.country, '| country_code:', d.country_code);
    console.log('photo_url:', d.photo_url);
    console.log('hash_pic:', d.hash_pic);
    console.log('created_time:', ts(d.created_time));
    console.log('last_activity_date:', ts(d.last_activity_date));
    console.log('no_show_reports:', (d.no_show_reports || []).length, '| late_reports:', (d.late_reports || []).length, '| rude_reports:', (d.rude_reports || []).length);
    try {
        const a = await admin.auth().getUser(uid);
        console.log('AUTH email:', a.email, '| phone:', a.phoneNumber, '| disabled:', a.disabled);
        console.log('AUTH providers:', a.providerData.map(p => `${p.providerId}:${p.email || p.phoneNumber || p.uid}`).join(', '));
        console.log('AUTH created:', a.metadata.creationTime, '| lastSignIn:', a.metadata.lastSignInTime);
    } catch (e) { console.log('AUTH lookup failed:', e.message); }
    return d;
}

async function main() {
    const gameRef = db.collection('games').doc(GAME_ID);
    const gameDoc = await gameRef.get();
    if (!gameDoc.exists) { console.log('GAME NOT FOUND:', GAME_ID); process.exit(1); }
    const g = gameDoc.data();

    console.log('======================================================');
    console.log('=== GAME', GAME_ID, '===');
    console.log('======================================================');
    console.log(JSON.stringify(g, (k, v) => {
        if (v && v._path) return `[ref:${v._path.segments.join('/')}]`;
        if (v && v.toDate) return v.toDate().toISOString();
        if (v && v._seconds !== undefined) return new Date(v._seconds * 1000).toISOString();
        return v;
    }, 2));

    // Organizer
    const organizerId = refToId(g.organizer);
    const org = await printUser(organizerId, 'ORGANIZER');

    // Centre (if distinct)
    const centreId = refToId(g.centre);
    if (centreId && centreId !== organizerId) {
        await printUser(centreId, 'CENTRE');
    }

    // Messages
    const msgs = await db.collection('messages').where('game_id', '==', gameRef).get();
    const sorted = msgs.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.created?.toDate?.() || 0) - (b.created?.toDate?.() || 0));
    console.log('\n======================================================');
    console.log(`=== MESSAGES (${sorted.length}) ===`);
    console.log('======================================================');
    for (const m of sorted) {
        console.log(`\n[${ts(m.created)}] ${m.author_name} (${refToId(m.author_id)}) type=${m.type || ''} source=${m.source || ''}`);
        if (m.text) console.log('  FR:', m.text);
        if (m.text_en) console.log('  EN:', m.text_en);
        if (m.pictures && m.pictures.length) console.log('  PICS:', JSON.stringify(m.pictures));
    }

    // Attendees
    console.log('\n======================================================');
    console.log(`=== ATTENDEES (${(g.attendees || []).length}) ===`);
    console.log('======================================================');
    for (const a of (g.attendees || [])) {
        const aid = refToId(a);
        const ad = await db.collection('users').doc(aid).get();
        if (ad.exists) {
            const u = ad.data();
            console.log(`- ${u.display_name} (${aid}) | ${u.email} | ${u.phone_number} | banned=${u.banned}`);
        } else {
            console.log(`- ${aid} (not found / plus_one)`);
        }
    }

    process.exit(0);
}

main().catch(e => { console.error('Error:', e); process.exit(1); });
