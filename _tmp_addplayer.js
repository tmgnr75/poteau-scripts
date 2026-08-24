const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const iso=v=>v&&v.toDate?v.toDate().toISOString():v;
(async()=>{
  // Payments stuck: created but never moved past the initial state, on games already played.
  const now=new Date();
  const snap=await db.collection('payments').orderBy('authorization_date','desc').limit(1500).get();
  const stuck=[];
  for(const d of snap.docs){
    const p=d.data();
    if(!p.game_ref) continue;
    if(p.capture_mode!=='game_minus_1h') continue;
    // 'abandoned' = user bailed on PaymentSheet (known noise). We want docs that are
    // NOT abandoned/captured/canceled/authorized-and-future, i.e. stuck in limbo.
    if(['captured','canceled','abandoned'].includes(p.status)) continue;
    const g=(await p.game_ref.get()).data();
    if(!g||!g.date) continue;
    if(g.date.toDate()>now) continue; // still upcoming, fine
    stuck.push({id:d.id,status:p.status,amt:p.amount,cur:p.currency,pi:p.payment_intent_id,
      game:p.game_ref.id,gdate:iso(g.date),gstatus:g.status,user:p.user_ref?.path});
  }
  console.log('PAST-GAME payments NOT captured/canceled/abandoned:',stuck.length);
  let sum=0;
  stuck.sort((a,b)=>String(a.gdate).localeCompare(String(b.gdate)));
  for(const s of stuck){
    const u=s.user?(await db.doc(s.user).get()).data():null;
    console.log(`  ${s.status.padEnd(11)} ${String(s.amt).padStart(4)} ${s.cur}  game ${s.gdate?.slice(0,16)} (${s.gstatus})  ${u?.display_name||'?'}  ${s.id}`);
    if(s.gstatus==='played') sum+=s.amt||0;
  }
  console.log('\nUncaptured revenue on PLAYED games:',sum,'EUR');
  process.exit(0);
})();
