const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString():(v||null);

(async()=>{
  // find IMPULSTAR PARK pro account(s)
  const pros=await db.collection('users').where('type','in',['pro','super_pro']).get();
  const centres=[];
  pros.forEach(d=>{const n=(d.data().centre_name||'').toLowerCase();if(n.includes('impulstar')||n.includes('impuls'))centres.push({uid:d.id,name:d.data().centre_name,tz:d.data().time_zone});});
  console.log('IMPULSTAR accounts:',JSON.stringify(centres,null,2));

  // games organized by these accounts around May 26 2026 (22:00 local = 20:00 UTC). Window May 25-27.
  const start=new Date('2026-05-25T00:00:00Z'),end=new Date('2026-05-27T23:59:59Z');
  for(const c of centres){
    const gs=await db.collection('games').where('organizer','==',c.uid).where('date','>=',start).where('date','<=',end).get();
    console.log(`\n=== ${c.name} (${c.uid}) games May 25-27 ===`);
    gs.forEach(g=>{const d=g.data();console.log(`  ${g.id} | ${ts(d.date)}->${ts(d.end_time)} | status=${d.status} | maxP=${d.max_players} | att=${(d.attendees||[]).length} | players_to_find=${d.players_to_find}`);});
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
