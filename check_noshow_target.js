const admin=require('firebase-admin');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club'});
const db=admin.firestore();
const ts=v=>v?.toDate?v.toDate().toISOString():(v||null);

const FP5_ORG='sss3dYi6nzWd7rEjwcQ30LGKudj1'; // Foot POWER 5 (organizer on 05-08 games)
const TRIO={sVaBM5QOhtNMAxWYSXKGm9H0Arf2:'Kassim',TBi7xlZkIgcTwhoT3JXmuO6xuMS2:'Fawzi',q0R7EVydkUhwJLqncbal7g7Vcp13:'Anis'};

(async()=>{
  // confirm the FP5 pro account
  const p=(await db.collection('users').doc(FP5_ORG).get()).data();
  console.log('FP5 org account:',FP5_ORG,'| centre_name=',p.centre_name,'| type=',p.type,'| display=',p.display_name);

  // current no_show_reports state for the trio
  console.log('\n=== current no_show_reports on the trio ===');
  for(const uid of Object.keys(TRIO)){
    const u=(await db.collection('users').doc(uid).get()).data();
    const nsr=(u.no_show_reports||[]).map(r=>r?.path||r);
    console.log(`${TRIO[uid]} (${uid}): ${nsr.length} reports -> ${JSON.stringify(nsr)}`);
  }

  // Which FP5-organized games is each trio member registered in? (these are the candidate "didn't show" games)
  console.log('\n=== trio games organized by FP5 (sss3...) ===');
  for(const uid of Object.keys(TRIO)){
    const u=(await db.collection('users').doc(uid).get()).data();
    const refs=[...(u.played_games||[]),...(u.games||[]),...(u.upcoming_games||[])];
    const uniq=[...new Map(refs.map(r=>[r.path,r])).values()];
    console.log(`\n-- ${TRIO[uid]} --`);
    for(const ref of uniq){let g;try{g=await ref.get()}catch{continue}if(!g.exists)continue;const d=g.data();
      if(d.organizer===FP5_ORG||d.centre==='Foot POWER 5'){
        console.log(`  ${g.id} | ${ts(d.date)} | status=${d.status} | organizer=${d.organizer} | centre=${d.centre}`);
      }
    }
  }
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
