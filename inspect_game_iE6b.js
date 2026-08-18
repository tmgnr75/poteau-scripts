const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const GAME_ID = 'iE6JdUyOz4efxGoPNpkH';
const rn = (r) => (r && r.path) ? r.path : (r && r._path ? r._path.segments.join('/') : r);

async function main() {
  const g = (await db.collection('games').doc(GAME_ID).get()).data();

  console.log('=== TEAMS full JSON ===');
  console.log(JSON.stringify(g.teams, (k,v)=> (v && v._path)? v._path.segments.join('/') : v, 2));

  console.log('\n=== ATTENDEES full ===', JSON.stringify(g.attendees.map(rn), null, 2));

  console.log('\n=== ORGANIZER DOC ===');
  const org = (await db.collection('users').doc('CjYWZZxOlUeaQiTLm1yIg0y82Q52').get()).data();
  console.log('display_name:', org && org.display_name, '| type:', org && org.type, '| sports:', org && org.sports);

  console.log('\n=== MESSAGES for this game ===');
  const msnap = await db.collection('messages').where('game_id','==', db.doc('games/'+GAME_ID)).get();
  const msgs = msnap.docs.map(d=>({id:d.id, ...d.data()}))
    .sort((a,b)=> (a.created && b.created ? a.created.toMillis()-b.created.toMillis():0));
  console.log('message count:', msgs.length);
  msgs.forEach(m => {
    const t = m.created && m.created.toDate ? m.created.toDate().toISOString() : '';
    console.log(`[${t}] type=${m.type} trigger=${m.trigger||''} author=${m.author_name||''} :: ${(m.text||'').slice(0,60)}`);
  });
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
