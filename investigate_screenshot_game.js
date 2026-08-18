const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

// Screenshot game: status MATCH COMPLET, 15:00->16:30, Fawzi Fawzi joined +4 (mardi 22:57), Anis Tabu joined +4 (mardi 22:58), Kassim removed 1 friend then left @14:21.
// These three are: Kassim sVaBM..., Fawzi TBi7..., Anis q0R7...
const KASSIM='sVaBM5QOhtNMAxWYSXKGm9H0Arf2', FAWZI='TBi7xlZkIgcTwhoT3JXmuO6xuMS2', ANIS='q0R7EVydkUhwJLqncbal7g7Vcp13';

async function dumpGame(g){
  const d=g.data();
  console.log(`\n===== GAME ${g.id} | ${ts(d.date)} -> ${ts(d.end_time)} | status=${d.status} | centre=${d.centre} | maxP=${d.max_players} | price=${d.price} | pay=${d.payment_type} =====`);
  const msgs=await db.collection('messages').where('game_id','==',g.ref).get();
  const rows=[];msgs.forEach(m=>{const md=m.data();rows.push({c:ts(md.created),a:md.author_name,t:md.type,tr:md.trigger,txt:md.text});});
  rows.sort((a,b)=>(a.c||'').localeCompare(b.c||''));
  rows.forEach(r=>console.log(`  [${r.c}] (${r.t}${r.tr?'/'+r.tr:''}) ${r.a}: ${r.txt||''}`));
}

async function main(){
  // Fawzi's games where he joined +4; intersect with Anis +4; check for a Kassim leave. Start time 15:00 local = 13:00 UTC.
  const fawziDoc=(await db.collection('users').doc(FAWZI).get()).data();
  const refs=[...(fawziDoc.played_games||[]),...(fawziDoc.games||[])];
  const uniq=[...new Map(refs.map(r=>[r.path,r])).values()];
  for(const ref of uniq){
    let g;try{g=await ref.get()}catch{continue}
    if(!g.exists)continue;const d=g.data();
    const att=(d.attendees||[]).map(a=>a?.path||'');
    const hasAnis=att.some(p=>p.includes(ANIS));
    const hasKassim=att.some(p=>p.includes(KASSIM));
    // also check messages for a Kassim "left"
    if(hasAnis){
      console.log(`candidate ${g.id} ${ts(d.date)} centre=${d.centre} status=${d.status} hasAnis=${hasAnis} hasKassimNow=${hasKassim}`);
    }
  }
  // Dump the most likely (the screenshot shows centre with field photos = a 5v5 indoor; "473 followers"). Just dump all candidates' chats.
  for(const ref of uniq){
    let g;try{g=await ref.get()}catch{continue}
    if(!g.exists)continue;const d=g.data();
    const att=(d.attendees||[]).map(a=>a?.path||'');
    if(att.some(p=>p.includes(ANIS))){
      // check if a Kassim ever left in chat
      const msgs=await db.collection('messages').where('game_id','==',g.ref).get();
      let kassimLeft=false;msgs.forEach(m=>{const md=m.data();if(md.author_name==='Kassim'&&md.type==='log'&&/left|quitt/i.test(md.trigger||''))kassimLeft=true;});
      if(kassimLeft){console.log('\n*** FOUND screenshot game (Kassim left) ***');await dumpGame(g);}
    }
  }
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
