const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
const GAME='PQBLWIkJ47uAR7r4fGVm';
const PAUL='n6W31XIsxidLFMyIWZ2u74PbtUs2';
const fmt=d=>d.toISOString().replace('T',' ').slice(0,19)+'Z';
const paris=d=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'short',timeStyle:'medium'}).format(d);
(async()=>{
  const g=await db.doc('games/'+GAME).get();
  if(!g.exists){console.log('game not found');process.exit(0);}
  const d=g.data();
  console.log('GAME', GAME);
  console.log('  centre:', d.centre, '| status:', d.status, '| date:', d.date?fmt(d.date.toDate()):'-', '| tz:', d.time_zone);
  console.log('  created_on:', d.created_on?fmt(d.created_on.toDate()):'(none)');
  console.log('  max_players:', d.max_players, '| attendees len:', (d.attendees||[]).length);
  const att=(d.attendees||[]).map(r=>r.id);
  console.log('  attendee ids (in order):');
  att.forEach((id,i)=>console.log(`    ${String(i).padStart(2)} ${id}${id===PAUL?'   <== PAUL':''}`));
  console.log('  paul index(es):', att.map((id,i)=>id===PAUL?i:null).filter(x=>x!==null).join(',')||'NOT PRESENT');
  console.log('\n  top-level fields:', Object.keys(d).sort().join(', '));
  process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
