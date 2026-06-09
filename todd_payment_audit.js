// Audit the NEW invoice period (Apr 16 -> today) game by game, resolving player names,
// so we can eyeball that new/recurring/full are correct. No model assumptions beyond the agreed ones.
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';
const PERIOD_START = '2026-04-16';
const MAY_START = '2026-05-01';
const laDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function uidOf(a) {
  if (a?.path) return a.path.split('/').pop();
  if (typeof a === 'string') return a.includes('/') ? a.split('/').pop() : a;
  return null;
}

(async () => {
  const snap = await db.collection('games').where('organizer', '==', TODD_UID).get();
  const games = [];
  snap.forEach(doc => {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : null;
    games.push({ id: doc.id, date, ld: date ? laDate(date) : null, status: d.status,
      max: d.max_players, attendees: Array.isArray(d.attendees) ? d.attendees : [] });
  });
  games.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

  // first-seen across ALL played games (incl. pre-period, so "recurring" reflects true history)
  const firstSeen = {};
  for (const g of games) {
    if (g.status !== 'played') continue;
    for (const uid of new Set(g.attendees.map(uidOf).filter(u => u && u !== TODD_UID)))
      if (!(uid in firstSeen)) firstSeen[uid] = g.id;
  }

  const billable = games.filter(g => g.status === 'played' && g.ld && g.ld >= PERIOD_START);

  // resolve names for all uids in the period
  const allUids = new Set();
  for (const g of billable) for (const u of g.attendees.map(uidOf).filter(u => u && u !== TODD_UID)) allUids.add(u);
  const names = {};
  await Promise.all([...allUids].map(async u => {
    try { const s = await db.collection('users').doc(u).get(); names[u] = s.exists ? (s.data().display_name || u.slice(0,6)) : `(missing:${u.slice(0,6)})`; }
    catch { names[u] = u.slice(0,6); }
  }));

  for (const g of billable) {
    const raw = g.attendees.map(uidOf).filter(Boolean).length;
    const isFull = g.max ? raw >= g.max - 2 : false;
    const players = [...new Set(g.attendees.map(uidOf).filter(u => u && u !== TODD_UID))];
    const isApril = g.ld < MAY_START;
    const newOnes = players.filter(u => firstSeen[u] === g.id);
    const recOnes = players.filter(u => firstSeen[u] !== g.id);
    console.log(`\n${g.ld}  ${isApril ? 'APR' : 'MAY'}  raw ${raw}/${g.max} ${isFull ? 'FULL' : 'not-full'}  | ${players.length} distinct players (${newOnes.length} new, ${recOnes.length} rec)`);
    console.log(`   NEW: ${newOnes.map(u => names[u]).join(', ') || '—'}`);
    console.log(`   REC: ${recOnes.map(u => names[u]).join(', ') || '—'}`);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
