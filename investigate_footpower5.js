const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

// Phones extracted from the screenshots Mohamed (Foot Power 5) sent.
const PHONES = [
    '+33761938950', // Kassim, 4 matchs, 75%, joined then left at last minute
    '+33788498021', // Fawzi Fawzi, 17 matchs, 100%, joined with 4 friends
    '+33652118367', // Anis Tabu, 8 matchs, 100%, joined with 4 friends
];

const NAMES = ['Kassim', 'Fawzi', 'Anis Tabu', 'Ayoub Hajji'];

function normPhone(p) {
    if (!p) return '';
    return String(p).replace(/[\s().-]/g, '');
}

async function findUsers() {
    const found = new Map(); // uid -> doc data

    // 1. By exact phone number
    for (const phone of PHONES) {
        const snap = await db.collection('users').where('phone_number', '==', phone).get();
        snap.forEach(d => found.set(d.id, { id: d.id, ...d.data(), _matchedBy: 'phone:' + phone }));
        // Also try without + and other variants by scanning later if nothing
        if (snap.empty) console.log(`No exact phone match for ${phone}`);
    }

    // 2. By display name (in case phone stored differently)
    for (const name of NAMES) {
        const snap = await db.collection('users').where('display_name', '==', name).get();
        snap.forEach(d => {
            if (!found.has(d.id)) found.set(d.id, { id: d.id, ...d.data(), _matchedBy: 'name:' + name });
        });
    }

    return found;
}

function summarizeUser(u) {
    return {
        uid: u.id,
        matchedBy: u._matchedBy,
        display_name: u.display_name,
        email: u.email,
        phone_number: u.phone_number,
        type: u.type,
        banned: u.banned || false,
        created_time: ts(u.created_time),
        last_activity_date: ts(u.last_activity_date),
        country: u.country,
        country_code: u.country_code,
        no_show_reports: (u.no_show_reports || []).length,
        late_reports: (u.late_reports || []).length,
        rude_reports: (u.rude_reports || []).length,
        positive_reports: (u.positive_reports || []).length,
        games_count: (u.games || []).length,
        played_games_count: (u.played_games || []).length,
        friends_count: (u.friends || []).length,
        blocked_users: (u.blocked_users || []).length,
    };
}

async function main() {
    console.log('=== Finding users ===\n');
    const users = await findUsers();
    if (users.size === 0) {
        console.log('NO USERS FOUND. Phone/name matching failed. Will need a broader scan.');
        process.exit(0);
    }

    for (const u of users.values()) {
        console.log(JSON.stringify(summarizeUser(u), null, 2));
        console.log('---');
    }

    console.log('\nUIDs found:', [...users.keys()].join(', '));
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
