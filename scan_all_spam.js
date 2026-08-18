const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : null;
const LIMIT = parseInt(process.env.LIMIT || '20000', 10);

// Already-handled UIDs (FootFactory operator rounds 1 & 2) — exclude from results.
const KNOWN = new Set([
    'wXU8AnN70fhWnVWj3DbtIcfNGXK2', 'WChWkRtCVQVILJyHDu4n5jsQ6FQ2', 'Bm1XJs3RTVcXHBKKX7m6ZI9O8JX2',
    'LmLGjNbsdyUkxXMCeRFEU71owo23', 'DdNdfIcPoXVvegRqdxVOYC9NO7j2',
]);

// Signals of off-platform redirection / competitor promo / recruiting. Tuned to catch
// the *pattern* (move off Poteau, pay-to-recruit, competitor app, raw phone/handle drops)
// while tolerating false positives — we review by hand below.
const SIGNALS = [
    { tag: 'phone-drop', rx: /\b0[67](?:[ .]?\d{2}){4}\b|\+33\s?[67](?:[ .]?\d{2}){4}/ },
    { tag: 'validate-by-sms', rx: /valider?.{0,20}(place|inscription).{0,20}(sms|num|au\s*0)|confirmation oblig|inscription oblig|sms au 0/i },
    { tag: 'competitor-app', rx: /footfactory|sporkly|notre (app|application)|sur l.?app(?!le)|autre application|t.l.charge.{0,15}app|app store|apps?\.apple|play\.google|\.online|\.club\b/i },
    { tag: 'recruit-pay', rx: /gagner? de l.argent|tu gagnes|r.compens.|en amenant des joueurs|en ramenant des joueurs|cherche.{0,20}organisateurs|nouveau concept/i },
    { tag: 'off-platform', rx: /whatsapp|tel.gram|t\.me\/|insta(gram)?\s*:|snap(chat)?\s*:|dm moi|contacte? moi (en|au|sur)|en dehors de poteau|hors (de l.?)?app/i },
    { tag: 'futsal-not-five', rx: /futsal et non (le )?five|c.est pas (au|le) five|pas au five|gymnase.{0,30}(et non|pas).{0,10}five/i },
];

async function main() {
    console.log(`Scanning last ${LIMIT} chat messages...\n`);
    const snap = await db.collection('messages')
        .where('type', '==', 'message')
        .orderBy('created', 'desc')
        .limit(LIMIT)
        .get();

    // author => { name, tags:Set, games:Set, samples:[], count }
    const authors = {};
    let oldest = null, newest = null;
    snap.forEach(doc => {
        const d = doc.data();
        const text = `${d.text || ''}`;
        if (!text.trim()) return;
        const c = ts(d.created);
        if (c) { if (!oldest || c < oldest) oldest = c; if (!newest || c > newest) newest = c; }
        const hits = SIGNALS.filter(s => s.rx.test(text)).map(s => s.tag);
        if (!hits.length) return;
        const uid = d.author_id?.id || 'unknown';
        if (KNOWN.has(uid)) return;
        const a = authors[uid] = authors[uid] || { name: d.author_name, tags: new Set(), games: new Set(), samples: [], count: 0 };
        hits.forEach(h => a.tags.add(h));
        if (d.game_id?.id) a.games.add(d.game_id.id);
        a.count++;
        if (a.samples.length < 3) a.samples.push(text.replace(/\n/g, ' ').slice(0, 160));
    });

    console.log(`Window: ${oldest} -> ${newest}\n`);

    // Score: more games hit + recruit/competitor/off-platform tags = more suspicious.
    const HEAVY = new Set(['competitor-app', 'recruit-pay', 'off-platform', 'futsal-not-five', 'validate-by-sms']);
    const ranked = Object.entries(authors).map(([uid, a]) => {
        const heavy = [...a.tags].filter(t => HEAVY.has(t)).length;
        const score = a.games.size * 2 + heavy * 3 + a.count;
        return { uid, ...a, heavy, score };
    }).sort((x, y) => y.score - x.score);

    console.log(`=== ${ranked.length} distinct authors with >=1 signal (excluding known-banned) ===\n`);
    // Focus list: multi-game OR heavy-signal authors (the ones worth a manual look).
    const focus = ranked.filter(a => a.games.size >= 2 || a.heavy >= 1);
    console.log(`--- FOCUS (${focus.length}): multi-game or heavy-signal ---`);
    for (const a of focus.slice(0, 40)) {
        console.log(`\n[score ${a.score}] ${a.uid} (${a.name}) — ${a.count} msgs / ${a.games.size} games / tags: ${[...a.tags].join(',')}`);
        a.samples.forEach(s => console.log(`     "${s}"`));
    }

    console.log(`\n\n--- LOW-PRIORITY (${ranked.length - focus.length} single-game, light-signal authors omitted; mostly legit "0X.. call me" coordination) ---`);
    process.exit(0);
}
main().catch(e => { console.error('Error:', e); process.exit(1); });
