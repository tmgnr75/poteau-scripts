const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
(async()=>{
  const now=new Date();
  // Games still 'published' whose end_time is in the past = should have flipped to 'played'
  const s=await db.collection('games').where('status','==','published').where('date','<',now).get();
  console.log(`published games with date in the past: ${s.size}`);
  const buckets={};
  let recent=[];
  s.forEach(d=>{
    const g=d.data();
    const days=Math.floor((now-g.date.toDate())/86400000);
    const b=days<=1?'0-1d':days<=7?'2-7d':days<=30?'8-30d':days<=180?'31-180d':'>180d';
    buckets[b]=(buckets[b]||0)+1;
    if(days<=3) recent.push({id:d.id,date:g.date.toDate().toISOString().slice(0,16),centre:(g.centre||'').slice(0,28),att:(g.attendees||[]).length});
  });
  console.log('by age:',JSON.stringify(buckets));
  console.log(`\nstuck within last 3 days: ${recent.length}`);
  recent.sort((a,b)=>a.date<b.date?1:-1).slice(0,15).forEach(r=>console.log(`  ${r.date}  ${r.centre.padEnd(28)} attendees=${r.att}  id=${r.id}`));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
