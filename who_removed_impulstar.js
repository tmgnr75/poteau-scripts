const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString():(v||null);

(async()=>{
  // 1. IMPULSTAR account facts
  const u=(await db.collection('users').doc('W5sO1hPR2vWRMrJvcyWqrFzBoVx2').get()).data();
  console.log('=== IMPULSTAR PARK account ===');
  console.log(JSON.stringify({type:u.type,gold_status:u.gold_status,centre_name:u.centre_name,display_name:u.display_name,phone:u.phone_number,email:u.email,app_version:u.app_version,role:u.role,last_activity:ts(u.last_activity_date)},null,2));

  // 2. The game organizer + who the removed/added userIds are
  const g=(await db.collection('games').doc('ljbnOjpFwn82aaeH5iOz').get()).data();
  console.log('\n=== game organizer ===', g.organizer, '| centre=',g.centre,'| status=',g.status);

  // 3. Resolve the userIds that appeared in removePlayer/addPlayer logs
  const ids=['twMAjBh2aecUqxZG1gZsCrkQdQw2','2Q6MaBOyVEevzlgs4U9WhO2ixM13','44ao2AjWf4ewv9Vd8LurPTssWdQ2','Peep7UhWmiWRSKonhIYbDWRJljY2','dkVLZHMPjvQf57epTOBMuUfyfnx1','EEr5Tsx0fAb6ezHazXQu4aLDkvL2','cwGOGaRWWoNm4Jj4VhgEUzhXNjH3','2al6TzACJoTDkWiXTapewc0nvKy2','WRGve2vu3bhVNJBw5LFfapNUZMr1'];
  console.log('\n=== identities of users in the logs ===');
  for(const id of ids){const d=(await db.collection('users').doc(id).get()).data()||{};console.log(`${id} | ${d.display_name} | type=${d.type} | gold=${d.gold_status} | appV=${d.app_version}`);}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
