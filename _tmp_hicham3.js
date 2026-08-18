const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const U='3G8pnBSR72Ycr2QvvX94hjBLq1u1';
const uref = db.doc('users/'+U);
const BEZONS='U3MriTZbPbTUEsU6RtRuHxDMKvg2';

(async () => {
  // 1. Which games did the MyUrban/UrbanSoccer messages happen in? Whose centres?
  console.log('=== centres of the games where he pushed rival apps ===');
  for (const gid of ['OeeVj272sFoc6gaGrqmh','DpC8rc5jkVML5KTH9jgw']) {
    const g=await db.doc('games/'+gid).get();
    if(!g.exists){console.log(gid,'MISSING');continue;}
    const x=g.data();
    console.log(`${gid}: centre=${x.centre} organizer=${x.organizer} date=${x.date?.toDate().toISOString()} status=${x.status}`);
    const o=await db.doc('users/'+x.organizer).get().catch(()=>null);
    console.log('   organizer name:', o&&o.exists?o.data().display_name:'n/a', '| type:', o&&o.exists?o.data().type:'n/a');
    console.log('   is LE FIVE Bezons organizer?', x.organizer===BEZONS);
  }

  // 2. Every game he ever touched that belongs to LE FIVE Bezons
  console.log('\n=== His interactions with LE FIVE Bezons games ===');
  const bez = await db.collection('games').where('organizer','==',BEZONS).get();
  console.log('total Bezons games:', bez.size);
  const msgs = await db.collection('messages').where('author_id','==',uref).get();
  const hisGameIds = new Set(msgs.docs.map(m=>m.data().game_id?.id).filter(Boolean));
  bez.docs.forEach(d=>{
    const x=d.data();
    const inAtt=(x.attendees||[]).some(r=>r.path===uref.path);
    const inInt=(x.interested||[]).some(r=>r.path===uref.path);
    if(inAtt||inInt||hisGameIds.has(d.id)){
      console.log(`  ${d.id} ${x.date?.toDate().toISOString().slice(0,16)} status=${x.status} attendee=${inAtt} interested=${inInt} hasMsg=${hisGameIds.has(d.id)}`);
    }
  });

  // 3. All messages in the card game window (18 Apr) across games he touched that day
  console.log('\n=== 18 April: every game he touched, with full chat ===');
  const day = msgs.docs.map(m=>m.data()).filter(m=>{
    const t=m.created?.toDate(); return t && t>=new Date('2026-04-18T00:00:00Z') && t<new Date('2026-04-19T00:00:00Z');
  });
  const dayGames=[...new Set(day.map(m=>m.game_id?.id))];
  for(const gid of dayGames){
    const g=await db.doc('games/'+gid).get(); const x=g.exists?g.data():{};
    console.log(`\n--- ${gid} centre=${x.centre} organizer=${x.organizer} (Bezons? ${x.organizer===BEZONS}) date=${x.date?.toDate().toISOString()} ---`);
    const cm=await db.collection('messages').where('game_id','==',db.doc('games/'+gid)).get();
    cm.docs.map(z=>z.data()).sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0))
      .forEach(z=>console.log(`  [${z.created?.toDate().toISOString()}] ${z.author_id?.path===uref.path?'>>HIM<<':''} ${z.author_name||z.author_id?.path||'-'}: ${(z.text||'').replace(/\n/g,' | ')}`));
  }
  process.exit(0);
})();
