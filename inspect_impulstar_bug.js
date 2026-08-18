const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString():(v||null);

(async()=>{
  const g=await db.collection('games').doc('ljbnOjpFwn82aaeH5iOz').get();
  const d=g.data();
  console.log('status=',d.status,'maxP=',d.max_players,'players_to_find=',d.players_to_find,'visibility=',d.visibility,'gold_exclusive=',d.gold_exclusive);
  console.log('payment_type=',d.payment_type,'price=',d.price);
  console.log('\nTEAMS/SPOTS:');
  (d.teams||[]).forEach((s,i)=>console.log(`  [${i}] status=${s.status} user=${s.user?.path||s.user||''} name=${s.name||''} plus_one=${s.plus_one||s.plusOne||''} reservedAt=${ts(s.reserved_at||s.reservedAt)}`));
  console.log('\nATTENDEES raw:');
  (d.attendees||[]).forEach((a,i)=>console.log(`  [${i}] ${a?.path||a}`));

  // resolve names of the unique attendee uids
  const uids=[...new Set((d.attendees||[]).map(a=>(a?.path||'').split('/')[1]).filter(Boolean))];
  console.log('\nUnique attendee identities:');
  for(const uid of uids){const u=(await db.collection('users').doc(uid).get()).data()||{};console.log(`  ${uid} = ${u.display_name} (${u.phone_number})`);}

  // full message log incl. ALL trigger types, with author + user fields
  console.log('\nFULL LOG (with trigger + user ref):');
  const msgs=await db.collection('messages').where('game_id','==',g.ref).get();
  const rows=[];msgs.forEach(m=>{const md=m.data();rows.push({c:ts(md.created),a:md.author_name,t:md.type,tr:md.trigger,user:md.user?.path||'',rw:md.reason_why});});
  rows.sort((a,b)=>(a.c||'').localeCompare(b.c||''));
  rows.filter(r=>r.t==='log').forEach(r=>console.log(`  [${r.c}] ${r.tr} | author=${r.a} | user=${r.user} | reason=${r.rw||''}`));
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
