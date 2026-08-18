// Passe TOUS les matchs de juin de Todd (published, passés) en 'played'.
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const TODD = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';
const NOW = new Date();
const APPLY = process.argv.includes('--apply');
const laDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

(async () => {
  const snap = await db.collection('games')
    .where('organizer', '==', TODD)
    .where('status', '==', 'published')
    .get();

  const cands = [];
  snap.forEach(doc => {
    const d = doc.data();
    const date = d.date && d.date.toDate ? d.date.toDate() : null;
    const ld = date ? laDate(date) : null;
    if (!ld || ld < '2026-06-01' || ld > '2026-06-30') return;
    if (date >= NOW) return; // ne pas clôturer un match futur
    cands.push({ id: doc.id, ld, raw: (d.attendees || []).length, max: d.max_players });
  });
  cands.sort((a, b) => a.ld.localeCompare(b.ld));

  console.log(`${cands.length} matchs de juin published (passés) à passer en played:\n`);
  for (const c of cands) console.log(`  ${c.ld}  ${c.raw}/${c.max}  ${c.id}`);
  if (!APPLY) { console.log('\nDry run. --apply pour écrire.'); return; }

  const batch = db.batch();
  for (const c of cands) batch.update(db.collection('games').doc(c.id), { status: 'played' });
  await batch.commit();
  console.log(`\n✅ ${cands.length} matchs passés en played.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
