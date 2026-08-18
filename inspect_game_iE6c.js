const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const GAME_ID = 'iE6JdUyOz4efxGoPNpkH';

async function main() {
  const msnap = await db.collection('messages').where('game_id','==', db.doc('games/'+GAME_ID)).get();
  const msgs = msnap.docs.map(d=>({id:d.id, ...d.data()}))
    .sort((a,b)=> (a.created && b.created ? a.created.toMillis()-b.created.toMillis():0));
  console.log('=== FULL MESSAGE DOCS ===');
  msgs.forEach(m => {
    console.log(JSON.stringify({
      id:m.id, type:m.type, trigger:m.trigger,
      author_name:m.author_name,
      author_id: m.author_id && m.author_id.path,
      user: m.user && m.user.path,
      created: m.created && m.created.toDate().toISOString()
    }, null, 2));
  });

  // Who is Sofiane? find by name
  console.log('\n=== SEARCH Sofiane KARAOUNI ===');
  const usnap = await db.collection('users').where('display_name','==','Sofiane KARAOUNI').get();
  usnap.docs.forEach(d => {
    const u = d.data();
    console.log(d.id, '| type:', u.type, '| padelSkill:', u.padel_skill_level, '| games:', (u.games||[]).length, '| banned:', u.banned);
  });
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
