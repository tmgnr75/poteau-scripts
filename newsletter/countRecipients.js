const admin = require('firebase-admin');
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function count() {
    const snapshot = await db.collection('users')
        .where('auth_email', '!=', false)
        .get();

    let total = 0;
    let excluded = { noEmail: 0, banned: 0, pro: 0, superPro: 0 };
    let languages = { fr: 0, en: 0, es: 0, it: 0, other: 0 };

    snapshot.forEach(doc => {
        const data = doc.data();
        if (!data.email) { excluded.noEmail++; return; }
        if (data.banned === true) { excluded.banned++; return; }
        if (data.type === 'pro') { excluded.pro++; return; }
        if (data.type === 'super_pro') { excluded.superPro++; return; }

        total++;
        const lang = data.language || 'fr';
        if (['fr', 'en', 'es', 'it'].includes(lang)) {
            languages[lang]++;
        } else {
            languages.other++;
        }
    });

    console.log('📊 Destinataires newsletter');
    console.log('============================');
    console.log('Total à envoyer:', total);
    console.log('');
    console.log('Par langue:');
    console.log('  FR:', languages.fr);
    console.log('  EN:', languages.en);
    console.log('  ES:', languages.es);
    console.log('  IT:', languages.it);
    console.log('  Autre (→FR):', languages.other);
    console.log('');
    console.log('Exclus:');
    console.log('  Sans email:', excluded.noEmail);
    console.log('  Banned:', excluded.banned);
    console.log('  Pro:', excluded.pro);
    console.log('  Super Pro:', excluded.superPro);
    process.exit(0);
}
count();
