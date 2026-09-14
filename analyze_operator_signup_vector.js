/**
 * Why does the same operator keep getting new accounts?
 *
 * Pulls every account we have ever banned as this operator, plus the two newest
 * (Sch / Aaa), and lays their identifiers side by side. The question is not
 * "are they spammers" -- that is settled -- but "which field, if any, could
 * have stopped the signup".
 *
 * Read-only. Writes nothing.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// Every account attributed to this operator, oldest first, plus the two new ones.
const KNOWN = [
    'wXU8AnN70fhWnVWj3DbtIcfNGXK2', // Sport Pour Tous !   2026-06-01
    'WChWkRtCVQVILJyHDu4n5jsQ6FQ2', // Antoine
    'Bm1XJs3RTVcXHBKKX7m6ZI9O8JX2', // Sport Pour Tous ! (throwaway)
    'LmLGjNbsdyUkxXMCeRFEU71owo23', // AR9                 2026-06-12
    'DdNdfIcPoXVvegRqdxVOYC9NO7j2', // Luigi Sadaka
    'RbEJnLuHwFX2nfZma5A6rrFPG7N2', // Antoine / roussel   2026-07-17
    'Yzi3wHs2ShcOf5s9ZXQfhtpyI9i2', // El Maestro          2026-07-18
    'fU8FPHJ2BMS8RjNG3bsbcJcFG3z1', // Anto                2026-07-22
    'QnN56ssiMjMLIU2kbF7vBHGeEf93', // Messsiii            2026-08-05
    '4uECtHDYyRSNaG5ocAs3qfdGWx82', // Michel Bastos       2026-08-17
    '10eBhZwN',                     // Phi (partial uid, may miss)
    'JfVIwSd9LHT79lexQ7kYRZu4q2k2', // Sch                 2026-09-12  NEW
    'gyWKtjl24Xf1hnzLwXerJAdyk933', // Aaa                 2026-09-14  NEW
];

const iso = (t) => t?.toDate?.().toISOString().replace('T', ' ').slice(0, 16) || '';

async function main() {
    const rows = [];
    for (const uid of KNOWN) {
        let d;
        try {
            const s = await db.collection('users').doc(uid).get();
            if (!s.exists) { rows.push({ uid, missing: true }); continue; }
            d = s.data();
        } catch (e) { rows.push({ uid, missing: true, err: e.message }); continue; }

        let authInfo = {};
        try {
            const u = await admin.auth().getUser(uid);
            authInfo = {
                disabled: u.disabled,
                authPhone: u.phoneNumber || null,
                providers: u.providerData.map((p) => p.providerId).join('+') || 'none',
                authCreated: u.metadata.creationTime,
            };
        } catch { authInfo = { disabled: '?', providers: '?' }; }

        rows.push({
            uid,
            name: d.display_name,
            email: d.email,
            phone: d.phone_number,
            connector: d.connector,
            banned: d.banned,
            created: iso(d.created_time),
            hash_pic: d.hash_pic,
            photo: d.photo_url ? 'yes' : 'no',
            country: d.country,
            ...authInfo,
        });
    }

    console.log('=== ACCOUNTS ===\n');
    for (const r of rows) {
        if (r.missing) { console.log(`${r.uid}  <<NOT FOUND>> ${r.err || ''}`); continue; }
        console.log(`${r.uid}  ${r.name}`);
        console.log(`   email=${r.email}  phone=${r.phone}`);
        console.log(`   connector=${r.connector}  authProviders=${r.providers}  authPhone=${r.authPhone}`);
        console.log(`   created=${r.created}  banned=${r.banned}  authDisabled=${r.disabled}`);
        console.log(`   hash_pic=${r.hash_pic}  photo=${r.photo}  country=${r.country}`);
        console.log('');
    }

    // --- What is actually shared? -------------------------------------
    console.log('=== FIELD OVERLAP ===\n');
    for (const field of ['phone', 'email', 'hash_pic', 'authPhone', 'providers', 'connector']) {
        const counts = new Map();
        for (const r of rows) {
            if (r.missing) continue;
            const v = r[field];
            if (v === undefined || v === null || v === '') continue;
            counts.set(v, (counts.get(v) || 0) + 1);
        }
        const dupes = [...counts.entries()].filter(([, n]) => n > 1);
        console.log(`${field}: ${counts.size} distinct values across ${rows.filter(r => !r.missing).length} accounts`);
        for (const [v, n] of dupes) console.log(`   REUSED x${n}: ${v}`);
        console.log('');
    }

    // --- Is phone_number even unique platform-wide? --------------------
    console.log('=== IS phone_number UNIQUE IN users? ===\n');
    for (const r of rows) {
        if (r.missing || !r.phone) continue;
        const s = await db.collection('users').where('phone_number', '==', r.phone).get();
        if (s.size > 1) {
            console.log(`${r.phone} -> ${s.size} accounts: ${s.docs.map(d => d.id).join(', ')}`);
        }
    }

    // --- Email domains -------------------------------------------------
    console.log('\n=== EMAIL DOMAINS ===\n');
    const domains = new Map();
    for (const r of rows) {
        if (r.missing || !r.email) continue;
        const dom = r.email.split('@')[1];
        domains.set(dom, [...(domains.get(dom) || []), r.email]);
    }
    for (const [dom, list] of domains) console.log(`${dom}: ${list.join(', ')}`);

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
