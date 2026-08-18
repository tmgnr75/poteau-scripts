/**
 * Phase 2: For each candidate "Andreas" user, find any payments made recently
 * (esp. Monday 2026-07-20 .. today) and see which game they target.
 * Also read the 17h game chat.
 */
const admin = require("firebase-admin");
const serviceAccount = require('/Users/tmgnr/Downloads/krank-club-firebase-adminsdk-bl4zy-0528b5d049.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const ANDREAS_UIDS = [
  '0K3kDxBRYPTo4sFUxrGv4QtHuEv2','847iU3zzmAec98Ww0O4qRKeVYMv2','D7aTSTmRu1aLJZrYMRYCRmgl7nB2',
  'dFNDFiXA21db4aNGZRughcFNNpr1','fLIygxGVevY0rKQRcnN3nXTGhf23','fOePoHgoeqdS7xmjA72DQdbRa6a2',
  'xC1j8RWMqrhkdHzIa73sMditJHD2','2pQlq54vbdcyLznTmndUXadEldm1','WbL6sHxOruRtYBpn8Ktej8lZMJB2',
  '6RD3ZDEWX6QUdHp8aQaz7Spmt6m1'
];
const GAME_17H = 'EQFZtPppyTHammCr0NMX';
const CENTRE_ADDR_PREFIX = "215 Rue d'Aubervilliers";

async function main() {
  console.log('='.repeat(80));
  console.log('ANDREAS PAYMENTS (last 7 days) + game targets');
  console.log('='.repeat(80));

  const since = new Date('2026-07-19T00:00:00Z');

  for (const uid of ANDREAS_UIDS) {
    const paySnap = await db.collection('payments')
      .where('user_ref', '==', db.doc('users/' + uid))
      .get();
    const recent = paySnap.docs.filter(p => {
      const d = p.data().authorization_date;
      const dt = d && d.toDate ? d.toDate() : null;
      return dt && dt >= since;
    });
    if (!paySnap.size) continue;
    const uSnap = await db.collection('users').doc(uid).get();
    const u = uSnap.data() || {};
    console.log(`\n--- ${uid} | ${u.display_name || u.first_name} | ${u.email} | ${u.phone_number} ---`);
    console.log(`   total payments: ${paySnap.size}, recent(>=07-19): ${recent.length}`);
    for (const p of (recent.length ? recent : paySnap.docs.slice(-3))) {
      const pd = p.data();
      let gAddr = '', gDate = '', gStatus = '';
      try {
        const gs = await pd.game_ref.get();
        const g = gs.data() || {};
        gAddr = g.address; gStatus = g.status;
        gDate = g.date && g.date.toDate ? g.date.toDate().toISOString() : g.date;
      } catch(e){}
      const dt = pd.authorization_date && pd.authorization_date.toDate ? pd.authorization_date.toDate().toISOString() : pd.authorization_date;
      const hit = (gAddr||'').startsWith(CENTRE_ADDR_PREFIX) ? '  <<< LE FIVE PARIS 18' : '';
      console.log(`   pay ${p.id} | status=${pd.status} | ${pd.amount}${pd.currency} | authz=${dt}`);
      console.log(`       game=${pd.game_ref && pd.game_ref.id} status=${gStatus} date=${gDate} addr=${gAddr}${hit}`);
    }
  }

  // Read 17h game chat
  console.log('\n' + '='.repeat(80));
  console.log('17h GAME CHAT (', GAME_17H, ')');
  const msgs = await db.collection('messages')
    .where('game_id', '==', db.doc('games/' + GAME_17H)).get();
  const arr = msgs.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => {
      const ta = a.created && a.created.toDate ? a.created.toDate().getTime() : 0;
      const tb = b.created && b.created.toDate ? b.created.toDate().getTime() : 0;
      return ta - tb;
    });
  console.log('messages:', arr.length);
  for (const m of arr) {
    const t = m.created && m.created.toDate ? m.created.toDate().toISOString() : '';
    console.log(`   [${t}] ${m.author_name} (${m.type||''}): ${(m.text||'').slice(0,160)}`);
  }

  console.log('\nDONE');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
