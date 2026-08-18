/**
 * Read-only test harness for the scanSpamOffenders detection logic.
 * Replicates the function's SPAM_SIGNATURE + shouldAutoBan() and runs it against
 * recent messages to confirm: (a) it catches the known operator, (b) it doesn't
 * flag legit users. NO writes.
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const KNOWN_PHONES = ["0680464480", "0680264872", "0658456523", "0689260100"];
const SPAM_SIGNATURE = new RegExp([
  "footfactory", "foot factory", "footfactory\\.(online|net)", "id6744173972",
  "sport pour tous", "football-loisir-amateur", "collectif f\\.?a",
  "nouveau concept", "gagne(s|r)? de l.argent", "en (amenant|ramenant) des joueurs",
  "on cherche.{0,20}organisateurs", "session de recrutement", "nouveaux joueurs uniquement",
  "inscription oblig", "confirmation oblig", "valider votre place",
  "sinon vous ne pourrez.{0,15}(pas )?(jouer|participer)",
  "notre (app|application)", "sur l.?app(?!le)", "le lien de paiement",
  "futsal et non (le )?five", "c.est pas (au|le) five",
  "0680464480", "0680264872", "0658456523", "0033680464480",
].join("|"), "i");
const norm = s => (s || "").replace(/[ .\-]/g, "");
const hasKnownPhone = t => KNOWN_PHONES.some(p => norm(t).includes(p));
const isSpam = t => SPAM_SIGNATURE.test(t || "") || hasKnownPhone(t);
const MIN_SPAM_MESSAGES = 4, MIN_DISTINCT_GAMES = 3;
const shouldAutoBan = a => a.usedKnownPhone || (a.spamCount >= MIN_SPAM_MESSAGES && a.games.size >= MIN_DISTINCT_GAMES);

(async () => {
  const snap = await db.collection('messages').where('type', '==', 'message').orderBy('created', 'desc').limit(8000).get();
  const authors = {};
  snap.forEach(doc => {
    const d = doc.data(); const text = `${d.text || ''} ${d.text_en || ''}`;
    if (!isSpam(text)) return;
    const uid = d.author_id?.id; if (!uid) return;
    const a = authors[uid] = authors[uid] || { name: d.author_name, spamCount: 0, games: new Set(), usedKnownPhone: false, sample: d.text || '' };
    a.spamCount++; if (d.game_id?.id) a.games.add(d.game_id.id); if (hasKnownPhone(text)) a.usedKnownPhone = true;
  });

  const flagged = [], skipped = [];
  for (const [uid, a] of Object.entries(authors)) {
    const udoc = await db.collection('users').doc(uid).get();
    const banned = udoc.exists && udoc.data().banned === true;
    const rec = { uid, name: a.name, spam: a.spamCount, games: a.games.size, knownPhone: a.usedKnownPhone, banned, wouldBan: shouldAutoBan(a) && !banned };
    (shouldAutoBan(a) ? flagged : skipped).push(rec);
  }

  console.log(`Scanned ${snap.size} msgs. Authors with spam signals: ${Object.keys(authors).length}\n`);
  console.log('=== WOULD AUTO-BAN (new, crosses threshold) ===');
  flagged.filter(r => r.wouldBan).forEach(r => console.log(`  ${r.uid} (${r.name}) spam=${r.spam} games=${r.games} knownPhone=${r.knownPhone}`));
  if (!flagged.some(r => r.wouldBan)) console.log('  (none — all already banned or nothing new)');

  console.log('\n=== crosses threshold but ALREADY BANNED (would skip) ===');
  flagged.filter(r => r.banned).forEach(r => console.log(`  ${r.uid} (${r.name}) spam=${r.spam} games=${r.games}`));

  console.log('\n=== flagged by signature but BELOW threshold (would NOT ban — check for legit false-positives) ===');
  skipped.sort((a, b) => b.spam - a.spam).slice(0, 25).forEach(r => console.log(`  ${r.uid} (${r.name}) spam=${r.spam} games=${r.games} knownPhone=${r.knownPhone} banned=${r.banned}`));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
