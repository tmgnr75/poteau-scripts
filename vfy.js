const admin=require('firebase-admin');
const sharp=require('sharp');
const fs=require('fs');
const sa=require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({credential:admin.credential.cert(sa),projectId:'krank-club',storageBucket:'krank-club.appspot.com'});
(async()=>{
  const rows=fs.readFileSync(process.argv[2],'utf8').split('\n').filter(Boolean).map(JSON.parse);
  console.log('verifying',rows.length,'rewritten users\n');
  let ok=0,bad=0;
  for(const r of rows){
    const d=await admin.firestore().collection('users').doc(r.uid).get();
    const url=d.data().photo_url;
    const pointsNew=url.includes(encodeURIComponent(r.newPath));
    const res=await fetch(url);
    const buf=Buffer.from(await res.arrayBuffer());
    const m=await sharp(buf).metadata().catch(()=>null);
    const origExists=(await admin.storage().bucket().file(r.oldPath).exists())[0];
    const good = pointsNew && res.ok && m && m.width>0 && origExists;
    console.log(`${good?'OK ':'BAD'}  ${r.uid.slice(0,10)}  http=${res.status} ${m?m.width+'x'+m.height+' '+m.format:'DECODE FAIL'} ${(buf.length/1024).toFixed(0)}KiB  origKept=${origExists}`);
    good?ok++:bad++;
  }
  console.log(`\n${ok} ok, ${bad} bad`);
})();
