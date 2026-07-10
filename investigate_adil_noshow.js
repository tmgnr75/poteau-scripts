const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const ADIL_UID = '2IdqLVYEkDM7rOnN8CfUndu6aDt1';
const COMPLAINANT_PHONE = '0666941929'; // Danny Fonseca

function ts(v) {
    return v && v.toDate ? v.toDate().toISOString() : v;
}

async function dumpUser(label, uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) {
        console.log(`\n=== ${label} (${uid}) === NOT FOUND`);
        return null;
    }
    const d = doc.data();
    console.log(`\n=== ${label} (${uid}) ===`);
    console.log('display_name:', d.display_name);
    console.log('first_name:', d.first_name, '| last_name:', d.last_name, '| nickname:', d.nickname);
    console.log('email:', d.email);
    console.log('phone_number:', d.phone_number);
    console.log('type:', d.type, '| banned:', d.banned);
    console.log('created_time:', ts(d.created_time));
    console.log('last_activity_date:', ts(d.last_activity_date));
    console.log('country:', d.country, '| language:', d.language);
    console.log('no_show_reports:', (d.no_show_reports || []).length);
    console.log('late_reports:', (d.late_reports || []).length);
    console.log('rude_reports:', (d.rude_reports || []).length);
    console.log('positive_reports:', (d.positive_reports || []).length);
    console.log('pending_feedback:', (d.pending_feedback || []).map(r => r.id));
    console.log('games count:', (d.games || []).length);

    try {
        const authUser = await admin.auth().getUser(uid);
        console.log('--- Auth ---');
        console.log('auth email:', authUser.email, '| auth phone:', authUser.phoneNumber);
        console.log('providers:', authUser.providerData.map(p => `${p.providerId}:${p.email || p.phoneNumber || p.uid}`).join(', '));
        console.log('lastSignInAt:', authUser.metadata.lastSignInTime);
    } catch (e) {
        console.log('Auth lookup failed:', e.message);
    }
    return { ref: doc.ref, data: d };
}

async function main() {
    const adil = await dumpUser('ADIL (accused)', ADIL_UID);

    // Find complainant by phone
    console.log('\n\n########## COMPLAINANT LOOKUP ##########');
    const phoneVariants = [
        COMPLAINANT_PHONE,
        '+33' + COMPLAINANT_PHONE.replace(/^0/, ''),
        '+33 ' + COMPLAINANT_PHONE.replace(/^0/, ''),
    ];
    let complainant = null;
    for (const p of phoneVariants) {
        const snap = await db.collection('users').where('phone_number', '==', p).limit(5).get();
        if (!snap.empty) {
            for (const doc of snap.docs) {
                complainant = await dumpUser(`COMPLAINANT (Danny) via phone ${p}`, doc.id);
            }
            break;
        }
    }
    if (!complainant) {
        console.log('Complainant not found by phone. Trying email danny.fonseca@hotmail.fr');
        const snap = await db.collection('users').where('email', '==', 'danny.fonseca@hotmail.fr').limit(5).get();
        for (const doc of snap.docs) {
            complainant = await dumpUser('COMPLAINANT (Danny) via email', doc.id);
        }
    }

    // Find the game: Adil in attendees, played ~9 July 2026 ~19:30, Speed Soccer Five
    console.log('\n\n########## GAME LOOKUP ##########');
    if (adil) {
        const gameRefs = (adil.data.games || []);
        console.log(`Adil has ${gameRefs.length} game refs. Fetching recent ones...`);
        const games = [];
        for (const gRef of gameRefs) {
            try {
                const g = await gRef.get();
                if (g.exists) games.push({ id: g.id, ref: g.ref, data: g.data() });
            } catch (e) {}
        }
        // Sort by date desc
        games.sort((a, b) => {
            const da = a.data.date && a.data.date.toDate ? a.data.date.toDate().getTime() : 0;
            const dbb = b.data.date && b.data.date.toDate ? b.data.date.toDate().getTime() : 0;
            return dbb - da;
        });
        console.log(`Showing most recent ${Math.min(8, games.length)} games:`);
        for (const g of games.slice(0, 8)) {
            const d = g.data;
            console.log(`\n  Game ${g.id}`);
            console.log('    date:', ts(d.date), '| status:', d.status);
            console.log('    address:', d.address, '| centre:', d.centre);
            console.log('    reservation_name:', d.reservation_name);
            console.log('    price:', d.price, d.currency, '| payment_type:', d.payment_type);
            console.log('    organizer:', d.organizer);
            console.log('    attendees:', (d.attendees || []).map(r => r.id));
            console.log('    no_show_players:', (d.no_show_players || []).map(r => r.id));
            console.log('    late_players:', (d.late_players || []).map(r => r.id));
        }
    }

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
