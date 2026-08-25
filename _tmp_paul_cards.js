const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
const PAUL='n6W31XIsxidLFMyIWZ2u74PbtUs2';
const paris=d=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'medium'}).format(d);
(async()=>{
  const u=await db.doc('users/'+PAUL).get();
  const d=u.data();
  console.log('PAUL', d.display_name, '| banned:', d.banned, '| created:', d.created_time?paris(d.created_time.toDate()):'-');
  console.log('  no_show_reports:',(d.no_show_reports||[]).length,'late_reports:',(d.late_reports||[]).length,'rude:',(d.rude_reports||[]).length);
  const c=await db.collection('users/'+PAUL+'/discipline_cards').get();
  console.log('\ndiscipline_cards:',c.size);
  c.docs.map(x=>({id:x.id,...x.data()}))
   .sort((a,b)=>(a.issued_at?.toDate()||0)-(b.issued_at?.toDate()||0))
   .forEach(x=>console.log(' ',x.id,JSON.stringify(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,v&&v.toDate?paris(v.toDate()):(v&&v.id?v.id:v)])))));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
