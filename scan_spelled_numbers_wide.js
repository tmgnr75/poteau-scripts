const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const squash = s => norm(s).replace(/[^a-z]/g, '');

const WORDS = ['quatrevingtdix','quatrevingt','soixantedix','zero','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','vingt','trente','quarante','cinquante','soixante','un','une'];
const SORTED = [...new Set(WORDS)].sort((a,b)=>b.length-a.length);

function chain(s){
  let best=0,bestLen=0;
  for(let st=0;st<s.length;st++){
    let i=st,n=0;
    while(i<s.length){const w=SORTED.find(w=>s.startsWith(w,i));if(!w)break;i+=w.length;n++}
    if(n>best||(n===best&&i-st>bestLen)){best=n;bestLen=i-st}
  }
  return {count:best,len:bestLen};
}

// Wider net than the strict pass: any of these is worth a human look.
function classify(raw){
  const s = squash(raw);
  const n = norm(raw);
  const tags = [];
  const {count,len} = chain(s);
  if (count >= 4 && len >= 14) tags.push(`spelled-${count}w`);
  // Digits embedded in a name, phone-shaped.
  if (/0[1-9](?:[\s.\-_]*\d){8}/.test(n.replace(/[^\d\s.\-_]/g,''))) tags.push('raw-digits');
  // Mixed: some digits + some number-words (the obvious next evasion).
  if (count >= 2 && /\d{2,}/.test(n)) tags.push('mixed');
  // Explicit contact solicitation in the NAME field.
  if (/whats?a?pp|wattsap|snap|insta|telegram|mon num|appel|contacte|tel\b|tél/i.test(n)) tags.push('contact-word');
  // Leetspeak O for zero at the start, as seen in "Osept..."
  if (/^o(?:sept|six)/.test(s)) tags.push('leet-O');
  return {tags,count,len};
}

async function main(){
  let scanned=0, hits=[], last=null;
  while(true){
    let q=db.collection('users').orderBy('__name__').limit(5000);
    if(last) q=q.startAfter(last);
    const snap=await q.get();
    if(snap.empty) break;
    snap.forEach(doc=>{
      scanned++;
      const d=doc.data();
      const fields={display_name:d.display_name,first_name:d.first_name,last_name:d.last_name,nickname:d.nickname};
      const all=[];
      for(const [f,raw] of Object.entries(fields)){
        if(!raw) continue;
        const {tags,count} = classify(raw);
        if(tags.length) all.push({field:f,raw,tags,count});
      }
      if(all.length){
        hits.push({uid:doc.id, banned:d.banned===true, gold:d.gold_status===true,
          email:d.email||null, phone:d.phone_number||null,
          created:d.created_time?.toDate?.().toISOString().slice(0,10)||null,
          lastActivity:d.last_activity_date?.toDate?.().toISOString().slice(0,10)||null,
          games:Array.isArray(d.games)?d.games.length:0, matches:all});
      }
    });
    last=snap.docs[snap.docs.length-1];
    process.stderr.write(`  ...${scanned}\r`);
    if(snap.size<5000) break;
  }
  console.error(`\nScanned ${scanned}. ${hits.length} hits.`);
  console.log(JSON.stringify(hits,null,1));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
