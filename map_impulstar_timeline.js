const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString().replace('T',' ').slice(5,19):(v||'');

(async()=>{
  const g=await db.collection('games').doc('ljbnOjpFwn82aaeH5iOz').get();
  const d=g.data();
  // Build a per-player running tally from the LOG events only, in order.
  const msgs=await db.collection('messages').where('game_id','==',g.ref).get();
  const ev=[];msgs.forEach(m=>{const md=m.data();ev.push({c:md.created?.toDate?md.created.toDate().getTime():0,cs:ts(md.created),a:md.author_name,t:md.type,tr:md.trigger||'',txt:md.text||''});});
  ev.sort((a,b)=>a.c-b.c);

  // delta per trigger
  const delta=tr=>{
    if(/^player_joined_plus_(\d+)/.test(tr))return 1+ +RegExp.$1;
    if(tr==='player_joined')return 1;
    if(/^friend_added_(\d+)/.test(tr))return +RegExp.$1;
    if(tr==='friend_added')return 1;
    if(/^player_left.*plus_(\d+)/.test(tr))return -(1+ +RegExp.$1);
    if(/^player_left/.test(tr))return -1;
    if(/^friend_removed_(\d+)/.test(tr))return -(+RegExp.$1);
    if(tr==='friend_removed')return -1;
    return 0;
  };
  const held={}; // player -> net spots they THINK they hold per the logs
  let totalLogged=0;
  console.log('TIME   | EVENT                                   | this player now logged-holds | total logged-spots');
  for(const e of ev){
    if(e.t==='log'){
      const dl=delta(e.tr);
      held[e.a]=(held[e.a]||0)+dl;
      totalLogged+=dl;
      console.log(`${e.cs} | ${(e.a+' '+e.tr).padEnd(40)} | ${String(held[e.a]).padStart(2)} | ${totalLogged}`);
    } else if(e.t==='message'){
      console.log(`${e.cs} |    💬 "${e.txt.slice(0,60)}"`);
    }
  }
  console.log('\n=== Per-player: spots the LOGS say they hold vs reality in final attendees ===');
  const att=(d.attendees||[]).map(a=>(a?.path||'').split('/')[1]);
  const cnt={};att.forEach(u=>cnt[u]=(cnt[u]||0)+1);
  // resolve names
  const names={};for(const u of [...new Set(att)]){const x=(await db.collection('users').doc(u).get()).data()||{};names[x.display_name]=u;cnt[x.display_name]=cnt[u];}
  const allNames=new Set([...Object.keys(held),...Object.keys(names)]);
  for(const n of allNames){
    console.log(`  ${n.padEnd(20)} logs-say=${held[n]??0}  final-attendees=${names[n]?cnt[n]||0:0}`);
  }
  console.log(`\nFINAL: attendees array length=${(d.attendees||[]).length}, unique users=${new Set(att).size}, status=${d.status}`);
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
