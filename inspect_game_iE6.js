const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const GAME_ID = 'iE6JdUyOz4efxGoPNpkH';

const refName = (r) => (r && r.path) ? r.path : r;

async function main() {
  const snap = await db.collection('games').doc(GAME_ID).get();
  if (!snap.exists) { console.log('Game not found'); return; }
  const g = snap.data();

  console.log('=== GAME CORE ===');
  console.log('status        :', g.status);
  console.log('sport         :', g.sport);
  console.log('date          :', g.date && g.date.toDate ? g.date.toDate().toISOString() : g.date);
  console.log('address       :', g.address);
  console.log('centre        :', g.centre);
  console.log('organizer     :', g.organizer);
  console.log('maxPlayers    :', g.max_players);
  console.log('playersToFind :', g.players_to_find);
  console.log('type          :', g.type);
  console.log('visibility    :', g.visibility);
  console.log('goldExclusive :', g.gold_exclusive);
  console.log('repeater      :', refName(g.repeater));

  console.log('\n=== ARRAY SIZES ===');
  for (const k of ['attendees','interested','outsiders','teams','messages','late_players','no_show_players','payments']) {
    const v = g[k];
    console.log(`${k.padEnd(16)}:`, Array.isArray(v) ? v.length : (v === undefined ? 'undefined' : typeof v));
  }

  console.log('\n=== ATTENDEES (raw) ===');
  const att = Array.isArray(g.attendees) ? g.attendees : [];
  att.forEach((a, i) => console.log(String(i).padStart(3), refName(a)));

  console.log('\n=== INTERESTED (raw) ===');
  const intr = Array.isArray(g.interested) ? g.interested : [];
  intr.forEach((a, i) => console.log(String(i).padStart(3), refName(a)));

  // dedup analysis
  const attStr = att.map(refName);
  const uniq = new Set(attStr);
  console.log('\n=== DEDUP ===');
  console.log('attendees total   :', attStr.length);
  console.log('attendees unique  :', uniq.size);
  const counts = {};
  attStr.forEach(s => counts[s] = (counts[s]||0)+1);
  const dupes = Object.entries(counts).filter(([,c]) => c > 1);
  console.log('duplicated refs   :', dupes.length);
  dupes.slice(0,20).forEach(([s,c]) => console.log('   x'+c, s));

  console.log('\n=== TEAMS ===');
  const teams = Array.isArray(g.teams) ? g.teams : [];
  console.log('teams length:', teams.length);
  teams.slice(0,30).forEach((t,i) => {
    console.log(String(i).padStart(3), 'status=', t.status, 'user=', refName(t.user), 'team=', t.team);
  });
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
