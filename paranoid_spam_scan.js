const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const KNOWN_BANNED_UIDS = new Set([
    'n3R2uzshLmftuthw5S5G7k14amb2',
    'c6yOIkNZtROhqPufCkT3U0LJjSI3',
    '5lIdyGuC2pYq9cKNiPPG4GK7mx53',
]);
const KNOWN_PHONE = '+33768250745';
const KNOWN_PHONE_PREFIX = '+3376825'; // for fuzzy match (typos / nearby numbers)
const SUSPICIOUS_NAMES = ['carter', 'nox', 'norman', 'dray'];
const SPAM_PATTERNS = [
    /sporkly/i,
    /pages\.dev/i,
    /t[ée]l[ée]chargez.*appli/i,
    /100%\s*gratuit/i,
    /road to/i,
    /contrairement à poteau/i,
    /quitter? poteau/i,
    /nouvelle appli/i,
];

async function scanRecentMessages() {
    console.log('\n========== 1) Scanning last 10k messages for spam patterns ==========');
    const snap = await db.collection('messages')
        .where('type', '==', 'message')
        .orderBy('created', 'desc')
        .limit(10000)
        .get();

    const hits = [];
    snap.forEach(doc => {
        const d = doc.data();
        const text = (d.text || '') + ' ' + (d.text_en || '') + ' ' + (d.text_es || '') + ' ' + (d.text_it || '');
        for (const pattern of SPAM_PATTERNS) {
            if (pattern.test(text)) {
                hits.push({
                    id: doc.id,
                    pattern: pattern.toString(),
                    author_id: d.author_id ? d.author_id.id : null,
                    author_name: d.author_name,
                    text: (d.text || '').slice(0, 200),
                    created: d.created ? d.created.toDate().toISOString() : null,
                    game_id: d.game_id ? d.game_id.id : null,
                });
                break;
            }
        }
    });

    console.log(`Scanned ${snap.size} messages, ${hits.length} pattern hits.`);
    if (hits.length > 0) {
        const byAuthor = {};
        for (const h of hits) {
            const k = h.author_id || 'unknown';
            if (!byAuthor[k]) byAuthor[k] = [];
            byAuthor[k].push(h);
        }
        for (const [aid, list] of Object.entries(byAuthor)) {
            const isKnown = KNOWN_BANNED_UIDS.has(aid);
            console.log(`\n  Author ${aid} (${list[0].author_name}) ${isKnown ? '[ALREADY BANNED]' : '⚠️ NEW'} — ${list.length} hits`);
            list.slice(0, 3).forEach(h => {
                console.log(`    [${h.created}] (${h.pattern}) "${h.text.replace(/\n/g, ' ').slice(0, 120)}"`);
            });
        }
    } else {
        console.log('  ✅ No spam patterns detected in recent messages.');
    }
}

async function scanRecentSignups() {
    console.log('\n========== 2) Scanning new accounts (last 7 days) for suspicious patterns ==========');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    const snap = await db.collection('users')
        .where('created_time', '>=', cutoff)
        .get();

    console.log(`${snap.size} new accounts created in last 7 days.`);

    const suspects = [];
    snap.forEach(doc => {
        const d = doc.data();
        const phone = (d.phone_number || '').replace(/\s/g, '');
        const fullName = `${d.display_name || ''} ${d.nickname || ''} ${d.first_name || ''} ${d.last_name || ''}`.toLowerCase();

        const reasons = [];
        if (phone === KNOWN_PHONE) reasons.push(`exact phone match`);
        else if (phone.startsWith(KNOWN_PHONE_PREFIX)) reasons.push(`phone prefix match (${phone})`);
        for (const name of SUSPICIOUS_NAMES) {
            if (fullName.includes(name)) reasons.push(`name contains "${name}"`);
        }
        if (reasons.length > 0) {
            suspects.push({ uid: doc.id, name: d.display_name, email: d.email, phone, reasons });
        }
    });

    if (suspects.length > 0) {
        console.log(`⚠️  ${suspects.length} suspect new account(s):`);
        suspects.forEach(s => {
            console.log(`  - ${s.uid} | ${s.name} | ${s.email} | ${s.phone}`);
            console.log(`    Reasons: ${s.reasons.join(', ')}`);
        });
    } else {
        console.log('  ✅ No suspect new accounts.');
    }
}

async function scanMassJoiners() {
    console.log('\n========== 3) Scanning for mass-joiners (users joining many games in <1h) ==========');
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    // Look for "log" type messages with trigger of joining games
    const snap = await db.collection('messages')
        .where('type', '==', 'log')
        .where('created', '>=', cutoff)
        .get();

    console.log(`${snap.size} log messages in last 24h.`);

    // Group by author
    const byAuthor = {};
    snap.forEach(doc => {
        const d = doc.data();
        if (!d.author_id) return;
        const aid = d.author_id.id;
        if (!byAuthor[aid]) byAuthor[aid] = { name: d.author_name, events: [] };
        byAuthor[aid].events.push({
            text: d.text || '',
            game_id: d.game_id ? d.game_id.id : null,
            created: d.created ? d.created.toDate() : null,
        });
    });

    // Flag users with >= 10 events in a 1h window
    const flagged = [];
    for (const [aid, info] of Object.entries(byAuthor)) {
        if (info.events.length < 10) continue;
        info.events.sort((a, b) => a.created - b.created);
        let maxBurst = 0;
        let burstStart = null;
        for (let i = 0; i < info.events.length; i++) {
            let count = 1;
            for (let j = i + 1; j < info.events.length; j++) {
                if ((info.events[j].created - info.events[i].created) <= 3600 * 1000) count++;
                else break;
            }
            if (count > maxBurst) {
                maxBurst = count;
                burstStart = info.events[i].created;
            }
        }
        if (maxBurst >= 10) {
            flagged.push({ uid: aid, name: info.name, total: info.events.length, maxBurst, burstStart });
        }
    }

    if (flagged.length > 0) {
        console.log(`⚠️  ${flagged.length} user(s) with burst activity (>=10 events in 1h):`);
        flagged.sort((a, b) => b.maxBurst - a.maxBurst);
        flagged.slice(0, 20).forEach(f => {
            const known = KNOWN_BANNED_UIDS.has(f.uid) ? '[BANNED]' : '';
            console.log(`  - ${f.uid} (${f.name}) ${known} — ${f.maxBurst} events in 1h, burst from ${f.burstStart.toISOString()}`);
        });
    } else {
        console.log('  ✅ No suspicious burst activity detected.');
    }
}

async function scanRecentMessageBursts() {
    console.log('\n========== 4) Scanning for users sending same message to many games ==========');
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const snap = await db.collection('messages')
        .where('type', '==', 'message')
        .where('created', '>=', cutoff)
        .get();

    console.log(`${snap.size} chat messages in last 24h.`);

    // Group by author -> normalized text -> set of games
    const byAuthor = {};
    snap.forEach(doc => {
        const d = doc.data();
        if (!d.author_id || !d.text || !d.game_id) return;
        const aid = d.author_id.id;
        const norm = d.text.trim().slice(0, 80).toLowerCase();
        if (!byAuthor[aid]) byAuthor[aid] = { name: d.author_name, byText: {} };
        if (!byAuthor[aid].byText[norm]) byAuthor[aid].byText[norm] = new Set();
        byAuthor[aid].byText[norm].add(d.game_id.id);
    });

    const flagged = [];
    for (const [aid, info] of Object.entries(byAuthor)) {
        for (const [text, games] of Object.entries(info.byText)) {
            if (games.size >= 5) {
                flagged.push({ uid: aid, name: info.name, text, gameCount: games.size });
            }
        }
    }

    if (flagged.length > 0) {
        console.log(`⚠️  ${flagged.length} suspicious copy-paste pattern(s):`);
        flagged.sort((a, b) => b.gameCount - a.gameCount);
        flagged.slice(0, 20).forEach(f => {
            const known = KNOWN_BANNED_UIDS.has(f.uid) ? '[BANNED]' : '';
            console.log(`  - ${f.uid} (${f.name}) ${known} — same text in ${f.gameCount} games`);
            console.log(`    "${f.text.replace(/\n/g, ' ')}"`);
        });
    } else {
        console.log('  ✅ No copy-paste spam patterns detected.');
    }
}

async function main() {
    await scanRecentMessages();
    await scanRecentSignups();
    await scanMassJoiners();
    await scanRecentMessageBursts();
    console.log('\n=== DONE ===');
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
