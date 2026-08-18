const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
const UID='8Ln3IaOmJYMNqFgywmsFQICiYrJ2';
const COMPLAINT=new Date('2026-07-25T22:44:08.485Z');
const fmt=d=>d.toISOString().replace('T',' ').slice(0,16)+'Z';
(async()=>{
  const ref=db.doc('users/'+UID);
  const s=await db.collection('games').where('attendees','array-contains',ref).get();
  const rows=s.docs.map(d=>({id:d.id,...d.data()}))
    .filter(g=>g.date)
    .sort((a,b)=>a.date.toDate()-b.date.toDate());
  console.log(`complaint sent: ${fmt(COMPLAINT)}  (Fri 25 Jul 2026, 22:44 UTC = 00:44 Paris Sat 26)`);
  console.log(`total games in attendees: ${rows.length}\n`);
  console.log('--- games within 30 days of the complaint ---');
  rows.forEach(g=>{
    const d=g.date.toDate();
    const days=(d-COMPLAINT)/86400000;
    if(Math.abs(days)<=30){
      const rel=days<0?`${(-days).toFixed(1)}d BEFORE`:`${days.toFixed(1)}d AFTER`;
      console.log(`  ${fmt(d)}  ${String(g.status).padEnd(10)} ${rel.padEnd(16)} ${(g.centre||g.address||'').slice(0,34)}`);
      console.log(`      id=${g.id} end_time=${g.end_time?fmt(g.end_time.toDate()):'(none)'} tz=${g.time_zone||'(none)'}`);
    }
  });
  console.log('\n--- ALL non-played games (any date) ---');
  rows.filter(g=>g.status!=='played').forEach(g=>{
    const d=g.date.toDate();
    const past=d<new Date();
    console.log(`  ${fmt(d)}  ${String(g.status).padEnd(10)} ${past?'PAST ':'FUTURE'} ${(g.centre||g.address||'').slice(0,34)}  id=${g.id}`);
  });
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
