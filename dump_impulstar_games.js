const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString():(v||null);
const IDS=['1pavnbfjyLwfDI8PPDae','ljbnOjpFwn82aaeH5iOz','pyD82ECFjbeKcUJYp1ik'];
(async()=>{
 for(const id of IDS){
  const g=await db.collection('games').doc(id).get();const d=g.data();
  console.log(`\n=============== GAME ${id} ===============`);
  console.log(`date=${ts(d.date)}->${ts(d.end_time)} status=${d.status} maxP=${d.max_players} att=${(d.attendees||[]).length} createdOn=${ts(d.created_on)}`);
  const att=(d.attendees||[]).map(a=>a?.path||a);
  console.log('attendees:',JSON.stringify(att));
  const msgs=await db.collection('messages').where('game_id','==',g.ref).get();
  const rows=[];msgs.forEach(m=>{const md=m.data();rows.push({c:ts(md.created),a:md.author_name,t:md.type,tr:md.trigger,txt:md.text});});
  rows.sort((a,b)=>(a.c||'').localeCompare(b.c||''));
  console.log(`messages: ${rows.length}`);
  rows.forEach(r=>console.log(`  [${r.c}] (${r.t}${r.tr?'/'+r.tr:''}) ${r.a}: ${(r.txt||'').slice(0,80)}`));
 }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
