const admin=require('firebase-admin');
admin.initializeApp({credential:admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),projectId:'krank-club'});
const db=admin.firestore();
const fr=d=>d?d.toDate().toLocaleString('fr-FR',{timeZone:'Europe/Paris'}):'-';
const IDS=['HY67TTF9qTQ9rqpyZkfC','UNf22jVoOrbG5myJp8He','OzjU6ejU7OjwIPRCxPrG','jIu51LAwN3daOpgzPnmz','XZrdTfP9JSdhOPTyTsnX','XdYj8PiTQPQTnUFAWL4i','3VoDb4OaVwBzSwMqoMhA','0wlBYVwho7Y2eL2bq002','uv1ioTByKELFi3360lSv','j4LVGIdRyzpB2zFfzF4t','24Q7WnrpKFKEjwjrlehy','t5fQciPyszJ4dpm5biYm','GI9ylmMBbIZzxcn5X2Aw','MhPOfHXSx6YtymOnv1Uo'];
(async()=>{
  console.log('now: '+new Date().toLocaleString('fr-FR',{timeZone:'Europe/Paris'}));
  let read=0,acted=0,replied=0;
  const moved=[];
  for(const id of IDS){
    const d=await db.collection('messenger').doc(id).get();
    const m=d.data(); const uref=m.conversation_with;
    const u=(await uref.get()).data();
    const sentAt=m.sent_at.toDate();
    const g=await db.collection('games').where('organizer','==',uref.id).get();
    const ng=g.docs.map(x=>x.data()).filter(x=>x.created_on&&x.created_on.toDate()>sentAt);
    const th=await db.collection('messenger').where('conversation_with','==',uref).get();
    const rp=th.docs.map(x=>x.data()).filter(x=>x.sender==='centre'&&x.sent_at&&x.sent_at.toDate()>sentAt);
    if(m.read_at)read++; if(ng.length)acted++; if(rp.length)replied++;
    if(m.read_at||ng.length||rp.length) moved.push((u.centre_name||'?')+' read='+(m.read_at?fr(m.read_at):'no')+' newGames='+ng.length+' replies='+rp.length);
  }
  console.log('\n=== 14 NUDGED CENTRES ===');
  console.log('  read: '+read+'/14 | created games: '+acted+'/14 | replied: '+replied+'/14');
  moved.forEach(x=>console.log('   MOVED: '+x));

  console.log('\n=== SOCCER ARENA 13 ===');
  const p=await db.collection('messenger').doc('g9wyQ3wBdptREXMxcci9').get();
  const UID='Jmd7OmNaMwYhDEyGVYyeq7oxODC2';
  const u=(await db.collection('users').doc(UID).get()).data();
  console.log('  slot-analysis msg read: '+(p.data().read_at?fr(p.data().read_at):'NO')+' | unread='+u.centre_unread_messenger);
  console.log('  last_activity_date: '+fr(u.last_activity_date));
  const g=await db.collection('games').where('organizer','==',UID).get();
  const now=new Date();
  for(const d of g.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>a.date-b.date)){
    const att=(d.attendees||[]).map(r=>r.id);
    const inv=await db.collection('game_invitations').where('game','==',db.doc('games/'+d.id)).get();
    const acc=inv.docs.filter(x=>x.data().status!=='pending').length;
    console.log('  '+fr(d.date)+' '+String(d.status).padEnd(9)+' '+att.length+'/'+d.max_players+' | inv='+inv.size+' non-pending='+acc+(d.date.toDate()<now?'  [PAST]':''));
  }
  process.exit(0);
})();
