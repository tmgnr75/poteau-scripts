const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const U='3G8pnBSR72Ycr2QvvX94hjBLq1u1';
const uref = db.doc('users/'+U);

(async () => {
  const s = await uref.get();
  if(!s.exists){console.log('NO USER DOC');process.exit(0);}
  const d = s.data();
  console.log('display_name      :', d.display_name);
  console.log('email             :', d.email, '| phone:', d.phone_number);
  console.log('created_time      :', d.created_time?.toDate().toISOString());
  console.log('last_activity_date:', d.last_activity_date?.toDate().toISOString());
  console.log('last_played_date  :', d.last_played_date?.toDate().toISOString());
  console.log('banned            :', d.banned, '| app_version:', d.app_version);
  console.log('discipline        :', JSON.stringify(d.discipline,(k,v)=>v&&v.toDate?v.toDate().toISOString():v,2));
  for (const f of ['no_show_reports','late_reports','rude_reports','positive_reports']) {
    const a=d[f]||[]; console.log(`${f.padEnd(18)}: ${a.length}`);
  }
  console.log('played_games:',(d.played_games||[]).length,'| games:',(d.games||[]).length,'| friends:',(d.friends||[]).length);

  const cards = await uref.collection('discipline_cards').get();
  console.log(`\n--- discipline_cards (${cards.size}) ---`);
  cards.forEach(c=>console.log(JSON.stringify({id:c.id,...c.data()},(k,v)=>v&&v.toDate?v.toDate().toISOString():(v&&v.path?v.path:v),2)));

  // flagged games
  console.log('\n--- games flagging him ---');
  for (const f of ['no_show_players','late_players','rude_players']) {
    const g = await db.collection('games').where(f,'array-contains',uref).get();
    g.forEach(x=>{const y=x.data();console.log(`${f}  ${x.id}  ${y.date?.toDate().toISOString().slice(0,16)}  ${y.centre}`);});
  }

  // attended games
  const gs = await db.collection('games').where('attendees','array-contains',uref).get();
  const rows = gs.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.date?.toMillis()||0)-(a.date?.toMillis()||0));
  console.log(`\n--- GAMES ATTENDED (${rows.length}) recent 20 ---`);
  const has=(arr)=>(arr||[]).some(r=>r.path===uref.path);
  rows.slice(0,20).forEach(r=>{
    const fl=[]; if(has(r.no_show_players))fl.push('NO_SHOW'); if(has(r.late_players))fl.push('LATE');
    if(has(r.rude_players))fl.push('RUDE'); if(has(r.good_players))fl.push('GOOD');
    console.log(`${r.date?.toDate().toISOString().slice(0,16)} ${r.status.padEnd(9)} ${(r.centre||'-').padEnd(24)} ${r.id} ${fl.join(',')}`);
  });
  let ns=0,lt=0,rd=0,gd=0;
  rows.forEach(r=>{if(has(r.no_show_players))ns++;if(has(r.late_players))lt++;if(has(r.rude_players))rd++;if(has(r.good_players))gd++;});
  console.log(`\nFLAG TOTALS over ${rows.length} games -> no_show:${ns} late:${lt} rude:${rd} good:${gd}`);
  process.exit(0);
})();
