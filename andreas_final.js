const admin = require("firebase-admin");
const sa = require('/Users/tmgnr/Downloads/krank-club-firebase-adminsdk-bl4zy-0528b5d049.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const UID='xC1j8RWMqrhkdHzIa73sMditJHD2', GAME='EQFZtPppyTHammCr0NMX';
(async()=>{
  // any payment doc for this user AND this game?
  const ps = await db.collection('payments')
    .where('user_ref','==',db.doc('users/'+UID))
    .where('game_ref','==',db.doc('games/'+GAME)).get();
  console.log('Payment docs for Andreas Segura on 17h game:', ps.size);
  ps.forEach(p=>console.log('  ',p.id, JSON.stringify(p.data())));

  // the game payment/confirmation config
  const g=(await db.collection('games').doc(GAME).get()).data();
  console.log('\nGame config: payment_type=%s price=%s currency=%s max=%s date=%s status=%s',
    g.payment_type,g.price,g.currency,g.max_players,g.date.toDate().toISOString(),g.status);
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
