const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
(async()=>{
  const since=new Date(Date.now()-7*86400000);
  const snap=await db.collection('games')
    .where('created_on','>=',since).get();
  let total=0, canceled=0, quick=[], canceledIds=[];
  snap.docs.forEach(d=>{
    const x=d.data(); total++;
    if(x.status==='canceled'||x.status==='hidden'){
      canceled++; canceledIds.push(d.ref);
      const c=x.created_on?.toDate?.(); const dt=x.date?.toDate?.();
      if(c&&dt) quick.push({id:d.id, lifeMin:null, leadH:(dt-c)/3600000});
    }
  });
  console.log(`games created in last 7d      ${total}`);
  console.log(`of which canceled/hidden      ${canceled}  (${(canceled/Math.max(total,1)*100).toFixed(1)}%)`);

  // How many pending invitations are attached to those canceled games?
  let invs=0, sampled=0;
  for(const ref of canceledIds.slice(0,120)){
    const q=await db.collection('game_invitations')
      .where('game','==',ref).where('status','==','pending').get();
    invs+=q.size; sampled++;
  }
  const avg=sampled?invs/sampled:0;
  console.log(`\nsampled ${sampled} canceled games`);
  console.log(`pending invitations on them   ${invs}`);
  console.log(`average per canceled game     ${avg.toFixed(1)}`);
  console.log(`\nESTIMATED WRITES to decline all, 7d: ${Math.round(avg*canceled).toLocaleString()}`);
  const w=Math.round(avg*canceled);
  console.log(`Firestore writes cost @ $0.09/100k:  $${(w/100000*0.09).toFixed(2)} per week`);
  console.log(`                                     $${(w/100000*0.09*52).toFixed(2)} per year`);
  process.exit(0);
})();
