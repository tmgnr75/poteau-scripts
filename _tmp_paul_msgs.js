const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
const GAME='PQBLWIkJ47uAR7r4fGVm';
const PAUL='n6W31XIsxidLFMyIWZ2u74PbtUs2';
const paris=d=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'medium'}).format(d);
(async()=>{
  const s=await db.collection('messages').where('game_id','==',db.doc('games/'+GAME)).get();
  const rows=s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.created?.toDate()||0)-(b.created?.toDate()||0));
  console.log('messages:',rows.length,'\n');
  rows.forEach(m=>{
    const who=m.author_id?.id||'(none)';
    const usr=m.user?.id||'';
    const mark=(who===PAUL||usr===PAUL)?' <== PAUL':'';
    console.log(`${paris(m.created.toDate())}  type=${String(m.type).padEnd(14)} trigger=${String(m.trigger||'-').padEnd(12)} author=${who.slice(0,8)} user=${usr.slice(0,8)}${mark}`);
    if(m.text) console.log(`      "${String(m.text).slice(0,90)}"`);
  });
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
