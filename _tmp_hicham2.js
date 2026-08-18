const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const U='3G8pnBSR72Ycr2QvvX94hjBLq1u1';
const uref = db.doc('users/'+U);

(async () => {
  const g = await db.doc('games/6AwGafhhropSIdKIGrim').get();
  if(!g.exists){console.log('CARD GAME MISSING');}
  else{
    const x=g.data();
    console.log('=== CARD GAME 6AwGafhhropSIdKIGrim ===');
    console.log('centre:',x.centre,'| date:',x.date?.toDate().toISOString(),'| status:',x.status);
    console.log('organizer:',x.organizer,'| max:',x.max_players,'| attendees:',(x.attendees||[]).length);
    console.log('in attendees :',(x.attendees||[]).some(r=>r.path===uref.path));
    console.log('in interested:',(x.interested||[]).some(r=>r.path===uref.path));
    console.log('no_show:',(x.no_show_players||[]).map(r=>r.path).join(', '));
    console.log('rude   :',(x.rude_players||[]).map(r=>r.path).join(', '));
    const m = await db.collection('messages').where('game_id','==',db.doc('games/6AwGafhhropSIdKIGrim')).get();
    console.log(`\n--- CHAT (${m.size}) ---`);
    m.docs.map(z=>z.data()).sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0))
      .forEach(z=>console.log(`[${z.created?.toDate().toISOString()}] ${z.author_id?.path===uref.path?'>>HICHAM<<':(z.author_id?.path||'-')} (${z.type||'-'}${z.trigger?'/'+z.trigger:''}) ${z.author_name||''}: ${(z.text||'').replace(/\n/g,' | ')}`));
  }

  // his no_show_report source
  const d=(await uref.get()).data();
  console.log('\nno_show_reports refs:',(d.no_show_reports||[]).map(r=>r.path).join(', '));
  console.log('positive_reports refs:',(d.positive_reports||[]).map(r=>r.path).join(', '));

  // interested games
  const si = await db.collection('games').where('interested','array-contains',uref).get();
  console.log(`\n--- interested-in games (${si.size}) ---`);
  si.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.date?.toMillis()||0)-(a.date?.toMillis()||0))
    .forEach(x=>console.log(`  ${x.date?.toDate().toISOString().slice(0,16)} ${x.status.padEnd(9)} ${(x.centre||'-').padEnd(22)} ${x.id}`));

  // all his messages
  const am = await db.collection('messages').where('author_id','==',uref).get();
  console.log(`\n--- ALL HIS MESSAGES (${am.size}) ---`);
  am.docs.map(z=>z.data()).sort((a,b)=>(a.created?.toMillis()||0)-(b.created?.toMillis()||0))
    .forEach(z=>console.log(`[${z.created?.toDate().toISOString()}] game=${z.game_id?.path} :: ${(z.text||'').replace(/\n/g,' | ')}`));
  process.exit(0);
})();
