/**
 * Before adding a 7-digit prefix to KNOWN_PHONE_PREFIXES, check it does not
 * cover a legitimate user.
 *
 * A prefix is ~1000 numbers of one carrier range. If an unbanned account sits
 * in the block, the prefix turns their next shared number into a high-severity
 * match -- the exact failure mode the module's own history warns about
 * (deriveFlaggedVenues, the "lien de paiement" removals).
 *
 * Read-only.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const NEW_PREFIXES = ['0680754', '0680794'];

// Same normalisation the detector uses, so this tests what will actually match.
const normalise = (s) =>
    (s || '').replace(/[\s.\-()]/g, '').replace(/\+33/g, '0').replace(/0033/g, '0');

async function main() {
    console.log('Scanning all users for phone numbers in the new blocks...\n');

    const snap = await db.collection('users').select('phone_number', 'display_name', 'email', 'banned', 'created_time').get();
    console.log(`${snap.size} user docs scanned.\n`);

    for (const prefix of NEW_PREFIXES) {
        const hits = [];
        snap.forEach((doc) => {
            const d = doc.data();
            const n = normalise(d.phone_number);
            if (n.includes(prefix)) {
                hits.push({
                    uid: doc.id,
                    name: d.display_name,
                    email: d.email,
                    phone: d.phone_number,
                    banned: d.banned === true,
                    created: d.created_time?.toDate?.().toISOString().slice(0, 10) || '?',
                });
            }
        });

        const clean = hits.filter((h) => !h.banned);
        console.log(`=== ${prefix} : ${hits.length} account(s), ${clean.length} NOT banned ===`);
        for (const h of hits) {
            console.log(`   ${h.banned ? 'BANNED ' : '>>CLEAN'} ${h.uid} | ${h.name} | ${h.email} | ${h.phone} | created ${h.created}`);
        }
        if (clean.length === 0) console.log('   -> safe to add');
        else console.log(`   -> WARNING: ${clean.length} legitimate account(s) would become high-severity`);
        console.log('');
    }

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
