const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const BEZONS='U3MriTZbPbTUEsU6RtRuHxDMKvg2';

(async()=>{
  // The double-card game: Moha w + Amine D, both carded 1 Jul ~20:25, game at 20:30
  console.log('=== games/egG31RSGQ8Wwtk9HOEnQ (carded 2 users) ===');
  const g=await db.doc('games/egG31RSGQ8Wwtk9HOEnQ').get(); const x=g.data();
  console.log('centre:',x.centre,'date:',x.date?.toDate().toISOString(),'status:',x.status,'max:',x.max_players);
  console.log('attendees:',(x.attendees||[]).length,'interested:',(x.interested||[]).length);
  console.log('price:',x.price,'| created_on:',x.created_on?.toDate().toISOString());
  const m=await db.collection('messages').where('game_id','==',db.doc('games/egG31RSGQ8Wwtk9HOEnQ')).get();
  console.log(`--- chat (${m.size}) ---`);
  m.docs.map(z=>z.data()).sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0))
   .forEach(z=>console.log(`  [${z.created?.toDate().toISOString()}] ${z.author_id?.path} (${z.trigger||z.type}) ${z.author_name||''}: ${(z.text||'').replace(/\n/g,' | ')}`));

  // What did Moha w and Amine D do that evening across ALL games?
  for(const [n,uid] of [['Moha w','2Q6MaBOyVEevzlgs4U9WhO2ixM13'],['Amine D','pRMXDzT5EsbPrbfJeCh5iT1jaUI2']]){
    const uref=db.doc('users/'+uid);
    const am=await db.collection('messages').where('author_id','==',uref).get();
    const day=am.docs.map(z=>z.data()).filter(z=>{const t=z.created?.toDate();
      return t&&t>=new Date('2026-07-01T00:00:00Z')&&t<new Date('2026-07-02T06:00:00Z');})
      .sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0));
    console.log(`\n=== ${n} on 1 July (${day.length} events) ===`);
    for(const z of day){
      const gg=await db.doc(z.game_id.path).get(); const gx=gg.exists?gg.data():{};
      console.log(`  [${z.created?.toDate().toISOString()}] ${gx.centre} (bezons=${gx.organizer===BEZONS}) game=${z.game_id.id} :: ${z.trigger||''} ${(z.text||'').replace(/\n/g,' | ')}`);
    }
  }
  process.exit(0);
})();
