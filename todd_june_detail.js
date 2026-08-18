// Détail complet de TOUS les matchs de juin de Todd (nouveau modèle: $50/match complet + $15/nouveau).
// Complet = raw attendees (incl. slots Todd) >= max - 4 (JUIN: seuil plus généreux, manque <=4).
// Nouveau = 1er match Todd (played) EVER.
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const TODD = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';
const laDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const uidOf = (a) => a && a.path ? a.path.split('/').pop() : (typeof a === 'string' ? (a.includes('/') ? a.split('/').pop() : a) : null);

(async () => {
  const snap = await db.collection('games').where('organizer', '==', TODD).get();
  const games = [];
  snap.forEach(doc => {
    const d = doc.data();
    const date = d.date && d.date.toDate ? d.date.toDate() : null;
    games.push({ id: doc.id, ld: date ? laDate(date) : null, status: d.status, max: d.max_players, attendees: Array.isArray(d.attendees) ? d.attendees : [] });
  });
  games.sort((a, b) => (a.ld || '').localeCompare(b.ld || ''));

  const firstSeen = {};
  for (const g of games) {
    if (g.status !== 'played') continue;
    for (const u of new Set(g.attendees.map(uidOf).filter(u => u && u !== TODD))) if (!(u in firstSeen)) firstSeen[u] = g.ld;
  }

  const juin = games.filter(g => g.ld && g.ld >= '2026-06-01' && g.ld <= '2026-06-30');

  // resolve names for a nicer breakdown of new players
  const allU = new Set();
  for (const g of juin) for (const u of g.attendees.map(uidOf).filter(u => u && u !== TODD)) allU.add(u);
  const names = {};
  await Promise.all([...allU].map(async u => { const s = await db.collection('users').doc(u).get(); names[u] = s.exists ? (s.data().display_name || u.slice(0, 6)) : '(?)'; }));

  console.log('=== TOUS LES MATCHS DE JUIN — Todd (nouveau modèle $50 complet + $15/nouveau) ===\n');
  let playedTotal = 0, pubEstTotal = 0;
  for (const g of juin) {
    const parsed = g.attendees.map(uidOf);
    const raw = parsed.filter(Boolean).length;
    const toddOcc = parsed.filter(u => u === TODD).length;
    const counts = {}; for (const u of parsed) if (u && u !== TODD) counts[u] = (counts[u] || 0) + 1;
    const dupes = Object.entries(counts).filter(([, c]) => c > 1);
    const players = Object.keys(counts);
    const full = g.max ? raw >= g.max - 4 : false; // JUIN: manque <=4 compte comme complet
    const newP = players.filter(u => firstSeen[u] === g.ld);
    const nw = newP.length, rc = players.length - nw;
    const pay = (full ? 50 : 0) + 15 * nw;
    const closed = g.status === 'played';
    if (closed) playedTotal += pay; else pubEstTotal += pay;

    console.log(`${g.ld}  [${g.status}${closed ? '' : ' → à clôturer'}]`);
    console.log(`   ${raw}/${g.max} joueurs (dont ${toddOcc} slots Todd) | ${players.length} distincts hors Todd | complet(≤4 manquants): ${full ? 'OUI ✅' : 'non ❌ (manque ' + (g.max - raw) + ')'}`);
    console.log(`   ${nw} nouveaux, ${rc} récurrents → ${full ? '$50' : '$0'} + ${nw}×$15 = $${pay}`);
    if (nw) console.log(`      nouveaux: ${newP.map(u => names[u]).join(', ')}`);
    if (dupes.length) console.log(`      ⚠️ doublons comptés 1×: ${dupes.map(([u, c]) => names[u] + '×' + c).join(', ')}`);
    console.log('');
  }

  console.log('========================================');
  console.log(`JUIN CLÔTURÉ (played) — payable maintenant : $${playedTotal}`);
  console.log(`JUIN OUVERT (published) — estimation à confirmer après clôture : $${pubEstTotal}`);
  console.log(`JUIN TOTAL estimé (si tout clôturé tel quel) : $${playedTotal + pubEstTotal}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
