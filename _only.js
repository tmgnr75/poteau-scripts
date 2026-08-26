// Leave exactly ONE case in Tim's pending_feedback so the Home card at the top
// is always the one under test. Seeded cases only -- guarded by seed_tag.
const admin=require("firebase-admin");
const sa=require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
admin.initializeApp({credential:admin.credential.cert(sa),projectId:"krank-club"});
const db=admin.firestore();
(async()=>{
  const want=process.argv[2];
  const q=await db.collection('games').where('seed_tag','==','wrapup_cases').get();
  const hit=q.docs.find(d=>d.get('seed_case')===want);
  if(!hit){ console.error('no such case:',want); process.exit(1); }
  await db.collection('users').doc('Wy5RXZJefwOZfAKG4MvOS6raU2f2')
    .update({pending_feedback:[hit.ref]});
  console.log('pending_feedback ->',want);
  process.exit(0);
})();
