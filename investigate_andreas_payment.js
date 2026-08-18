/**
 * Investigation: Centre reports player "Andreas" paid Monday for a game today
 * at 17h but doesn't appear on the match.
 * Centre UID: UQf33jQhVZhle917nO0h7D5qclV2
 */
const admin = require("firebase-admin");
const serviceAccount = require('/Users/tmgnr/Downloads/krank-club-firebase-adminsdk-bl4zy-0528b5d049.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const CENTRE_UID = 'UQf33jQhVZhle917nO0h7D5qclV2';

async function investigate() {
  console.log('='.repeat(80));
  console.log('ANDREAS PAYMENT INVESTIGATION');
  console.log('='.repeat(80));

  // 1. Centre doc
  const centreSnap = await db.collection('users').doc(CENTRE_UID).get();
  if (!centreSnap.exists) { console.log('CENTRE NOT FOUND'); return; }
  const c = centreSnap.data();
  console.log('\n--- CENTRE ---');
  console.log('centre_name:', c.centre_name);
  console.log('display_name:', c.display_name);
  console.log('email:', c.email);
  console.log('type:', c.type);
  console.log('time_zone:', c.time_zone);
  console.log('centre_currency:', c.centre_currency);
  console.log('centre_payment_type:', c.centre_payment_type);
  console.log('accounts:', c.accounts);

  // 2. Find games organized by this centre today (around 17h)
  // Today = 2026-07-24. Search a window of games with date on 2026-07-24.
  const now = new Date();
  const dayStart = new Date('2026-07-24T00:00:00Z');
  const dayEnd = new Date('2026-07-25T06:00:00Z'); // wide to cover TZ

  const gamesSnap = await db.collection('games')
    .where('organizer', '==', CENTRE_UID)
    .where('date', '>=', dayStart)
    .where('date', '<=', dayEnd)
    .get();

  console.log(`\n--- GAMES organized by centre on 2026-07-24 (${gamesSnap.size}) ---`);
  const games = [];
  gamesSnap.forEach(d => {
    const g = d.data();
    games.push({ id: d.id, ...g });
    console.log(`\nGame ${d.id}`);
    console.log('  date:', g.date && g.date.toDate ? g.date.toDate().toISOString() : g.date);
    console.log('  status:', g.status);
    console.log('  address:', g.address);
    console.log('  reservation_name:', g.reservation_name);
    console.log('  max_players:', g.max_players, 'attendees:', (g.attendees||[]).length);
    console.log('  payment_type:', g.payment_type, 'price:', g.price, 'currency:', g.currency);
  });

  // 3. For each game, dump attendees, outsiders, teams, payments
  for (const g of games) {
    console.log('\n' + '='.repeat(60));
    console.log('DETAIL game', g.id, '@', g.date && g.date.toDate ? g.date.toDate().toISOString() : g.date);

    // attendees
    const attRefs = g.attendees || [];
    console.log(`\n  ATTENDEES (${attRefs.length}):`);
    for (const ref of attRefs) {
      try {
        const uSnap = await ref.get();
        const u = uSnap.data() || {};
        console.log(`   - ${uSnap.id} | ${u.display_name || u.first_name+' '+u.last_name} | ${u.email} | ${u.phone_number}`);
      } catch (e) { console.log('   - (unreadable ref)', ref.path, e.message); }
    }

    // teams / spots
    if (g.teams) {
      console.log('\n  TEAMS/SPOTS:');
      console.log(JSON.stringify(g.teams, null, 2));
    }

    // outsiders subcollection
    const outSnap = await db.collection('games').doc(g.id).collection('outsiders').get();
    console.log(`\n  OUTSIDERS (${outSnap.size}):`);
    outSnap.forEach(o => console.log('   -', o.id, JSON.stringify(o.data())));

    // payments for this game
    const paySnap = await db.collection('payments')
      .where('game_ref', '==', db.doc('games/' + g.id)).get();
    console.log(`\n  PAYMENTS (${paySnap.size}):`);
    for (const p of paySnap.docs) {
      const pd = p.data();
      let payerName = '';
      try { const us = await pd.user_ref.get(); payerName = (us.data()||{}).display_name || (us.data()||{}).first_name; } catch(e){}
      console.log(`   - ${p.id} | payer=${pd.user_ref && pd.user_ref.id} (${payerName}) | status=${pd.status} | amount=${pd.amount} ${pd.currency} | intent=${pd.payment_intent_id}`);
      console.log(`       authorization_date=${pd.authorization_date && pd.authorization_date.toDate ? pd.authorization_date.toDate().toISOString() : pd.authorization_date}`);
    }
  }

  // 4. Search for user "Andreas" globally (display_name / first_name)
  console.log('\n' + '='.repeat(80));
  console.log('SEARCH USERS named "Andreas"');
  for (const field of ['first_name', 'display_name']) {
    const s = await db.collection('users')
      .orderBy(field)
      .startAt('Andreas').endAt('Andreas')
      .limit(20).get().catch(e => { console.log('query err', field, e.message); return {forEach:()=>{}, size:0}; });
    console.log(`\n  by ${field} (${s.size||0}):`);
    s.forEach && s.forEach(d => {
      const u = d.data();
      console.log(`   - ${d.id} | ${u.display_name || (u.first_name+' '+u.last_name)} | ${u.email} | ${u.phone_number}`);
    });
  }
  // also lowercase
  for (const field of ['first_name', 'display_name']) {
    const s = await db.collection('users')
      .orderBy(field)
      .startAt('andreas').endAt('andreas')
      .limit(20).get().catch(e => ({forEach:()=>{}, size:0}));
    console.log(`\n  by ${field} lowercase (${s.size||0}):`);
    s.forEach && s.forEach(d => {
      const u = d.data();
      console.log(`   - ${d.id} | ${u.display_name || (u.first_name+' '+u.last_name)} | ${u.email} | ${u.phone_number}`);
    });
  }

  console.log('\nDONE');
}

investigate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
