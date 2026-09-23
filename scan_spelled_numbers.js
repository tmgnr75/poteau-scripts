const admin = require('firebase-admin');
const serviceAccount = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

// French digit words, including the compound forms used in phone numbers
// (soixante-dix, quatre-vingt, quatre-vingt-dix ...).
const WORDS = [
  'zero','zéro','un','une','deux','trois','quatre','cinq','six','sept','huit','neuf',
  'dix','onze','douze','treize','quatorze','quinze','seize',
  'vingt','trente','quarante','cinquante','soixante','cent',
];
// Normalise: lowercase, strip accents, strip separators.
const norm = s => (s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z]/g, '');

// Count how many digit-words appear back-to-back in the squashed string.
// Greedy longest-match walk so "soixantedix" counts once, not twice.
const SORTED = [...new Set(WORDS.map(norm))].sort((a, b) => b.length - a.length);

function chainStats(s) {
  let best = 0, bestLen = 0;
  for (let start = 0; start < s.length; start++) {
    let i = start, n = 0;
    while (i < s.length) {
      const w = SORTED.find(w => s.startsWith(w, i));
      if (!w) break;
      i += w.length; n++;
    }
    if (n > best || (n === best && i - start > bestLen)) { best = n; bestLen = i - start; }
  }
  return { count: best, len: bestLen };
}

// A French mobile spelled out is ~10 digits => many chained words and a long run.
// Threshold tuned low enough to catch partials, results reviewed by hand.
const MIN_WORDS = 5;
const MIN_LEN = 20;

async function main() {
  console.log('Scanning users for spelled-out-number display names...\n');
  let scanned = 0, hits = [];
  let last = null;
  while (true) {
    let q = db.collection('users').orderBy('__name__').limit(5000);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach(doc => {
      scanned++;
      const d = doc.data();
      const fields = {
        display_name: d.display_name,
        first_name: d.first_name,
        last_name: d.last_name,
        nickname: d.nickname,
      };
      for (const [field, raw] of Object.entries(fields)) {
        if (!raw) continue;
        const s = norm(raw);
        if (s.length < MIN_LEN) continue;
        const { count, len } = chainStats(s);
        if (count >= MIN_WORDS && len >= MIN_LEN) {
          hits.push({
            uid: doc.id, field, raw, words: count, runLen: len,
            banned: d.banned === true,
            gold: d.gold_status === true,
            email: d.email || null,
            phone: d.phone_number || null,
            created: d.created_time?.toDate?.().toISOString() || null,
            lastActivity: d.last_activity_date?.toDate?.().toISOString() || null,
            games: Array.isArray(d.games) ? d.games.length : 0,
          });
          break;
        }
      }
    });
    last = snap.docs[snap.docs.length - 1];
    process.stderr.write(`  ...${scanned}\r`);
    if (snap.size < 5000) break;
  }
  console.log(`\nScanned ${scanned} users. ${hits.length} hit(s).\n`);
  hits.sort((a, b) => b.words - a.words);
  console.log(JSON.stringify(hits, null, 2));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
