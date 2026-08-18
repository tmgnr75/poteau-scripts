const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const U='3G8pnBSR72Ycr2QvvX94hjBLq1u1', uref=db.doc('users/'+U);
const BEZONS='U3MriTZbPbTUEsU6RtRuHxDMKvg2';

(async()=>{
  // A. The 4 Bezons-carded users: what do they have in common?
  console.log('=== The 4 users carded by LE FIVE Bezons ===');
  const s=await db.collection('users').where('discipline.last_reason','==','Suspension demandée par LE FIVE Bezons').get();
  for(const d of s.docs){
    const x=d.data();
    const cards=await d.ref.collection('discipline_cards').get();
    console.log(`\n${x.display_name} (${d.id})`);
    console.log(`  banned=${x.banned} cards=${x.discipline?.cards} card_at=${x.discipline?.last_card_at?.toDate().toISOString()}`);
    console.log(`  reports: noshow=${(x.no_show_reports||[]).length} late=${(x.late_reports||[]).length} rude=${(x.rude_reports||[]).length} pos=${(x.positive_reports||[]).length}`);
    console.log(`  created=${x.created_time?.toDate().toISOString().slice(0,10)} last_played=${x.last_played_date?.toDate().toISOString().slice(0,10)}`);
    cards.forEach(c=>{const y=c.data();console.log(`  card: ${y.colour} ${y.issued_at?.toDate().toISOString()} game=${y.game?.path} game_date=${y.game_date?.toDate().toISOString()} centre=${y.game_centre}`);});
  }

  // B. For each, was the card game EMPTY (0 attendees) like Hicham's?
  console.log('\n\n=== card-game shape for each Bezons case ===');
  for(const d of s.docs){
    const cards=await d.ref.collection('discipline_cards').get();
    for(const c of cards.docs){
      const y=c.data(); if(!y.game) continue;
      const g=await db.doc(y.game.path).get();
      if(!g.exists){console.log(`${d.data().display_name}: card game MISSING ${y.game.path}`);continue;}
      const gx=g.data();
      const inAtt=(gx.attendees||[]).some(r=>r.id===d.id);
      console.log(`${d.data().display_name}: game ${y.game.id} status=${gx.status} attendees=${(gx.attendees||[]).length} userInAttendees=${inAtt} date=${gx.date?.toDate().toISOString()}`);
    }
  }

  // C. Hicham: full join/leave churn timeline - count same-slot multi-joins
  console.log('\n\n=== Hicham: join/leave churn ===');
  const msgs=await db.collection('messages').where('author_id','==',uref).get();
  const logs=msgs.docs.map(m=>m.data()).filter(m=>m.type==='log').sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0));
  let joins=0,leaves=0;
  logs.forEach(m=>{if(m.trigger==='player_joined')joins++;if((m.trigger||'').startsWith('player_left'))leaves++;});
  console.log(`joins=${joins} leaves=${leaves} (leave rate ${(leaves/joins*100).toFixed(0)}%)`);
  // quick-leave: joined and left same game within 30 min
  const byGame={};
  logs.forEach(m=>{const g=m.game_id?.id; if(!g)return; (byGame[g]=byGame[g]||[]).push(m);});
  let quick=0;
  Object.entries(byGame).forEach(([g,arr])=>{
    for(let i=0;i<arr.length-1;i++){
      if(arr[i].trigger==='player_joined'&&(arr[i+1].trigger||'').startsWith('player_left')){
        const dt=(arr[i+1].created.toMillis()-arr[i].created.toMillis())/60000;
        if(dt<30){quick++;}
      }
    }
  });
  console.log(`join->leave within 30min: ${quick}`);
  process.exit(0);
})();
