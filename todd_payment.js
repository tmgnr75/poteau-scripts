// Compute Todd's performance pay. Confirmed rules with Tim (2026-06-09):
//
//   - Period: games on/after 2026-04-16 (last invoice 000005 cutoff), LA time.
//   - OLD model (LA date in [2026-04-16 .. 2026-05-31], i.e. April AND May):
//       $15/new player + $10/recurring player.
//   - NEW model (LA date >= 2026-06-01): $50/match (must be FULL) + $15/new player. No recurring pay.
//     (Axel confirmed 2026-06-09: the $50/match model starts in JUNE, not May.)
//   - FULL = raw attendees length (INCLUDING Todd's plus-one slots) >= max_players - 2.
//            (Confirmed: a May game missing 2 players or fewer counts as full for the $50.)
//            Todd's repeated UID = real humans he brought, so they count toward "full".
//   - Player pay (new/recurring) only for DISTINCT real Poteau accounts, EXCLUDING Todd's own UID.
//   - "New player" = player's first EVER appearance across all of Todd's played games (LA-date order).
//   - status must be 'played'.
//   - Todd's games = organizer == TODD_UID.

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';
const PERIOD_START = '2026-04-16'; // LA date, inclusive
const NEW_MODEL_START = '2026-06-01'; // LA date: OLD model (Apr+May) -> NEW model ($50/match)
const RATE = 1.17;                 // 1 EUR = 1.17 USD (last invoice rate)

const laDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function uidOf(a) {
  if (a?.path) return a.path.split('/').pop();
  if (typeof a === 'string') {
    if (a === 'plus_one' || a.startsWith('plus_one') || a.startsWith('outsider')) return null;
    return a.includes('/') ? a.split('/').pop() : a;
  }
  return null;
}

(async () => {
  const snap = await db.collection('games').where('organizer', '==', TODD_UID).get();
  const games = [];
  snap.forEach(doc => {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : (d.date ? new Date(d.date) : null);
    games.push({
      id: doc.id, date, ld: date ? laDate(date) : null, status: d.status,
      max: d.max_players, attendees: Array.isArray(d.attendees) ? d.attendees : [],
      address: d.address || d.centre || '',
    });
  });
  games.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

  // First-seen map across ALL of Todd's PLAYED games (excluding Todd himself).
  const firstSeenGameId = {}; // uid -> game id of first appearance
  for (const g of games) {
    if (g.status !== 'played') continue;
    const uids = new Set(g.attendees.map(uidOf).filter(u => u && u !== TODD_UID));
    for (const uid of uids) if (!(uid in firstSeenGameId)) firstSeenGameId[uid] = g.id;
  }

  // Flag any past games STILL published (should be none for May after our fix; June expected).
  const now = new Date();
  const pastPublished = games.filter(g => g.status === 'published' && g.date && g.date < now);
  if (pastPublished.length) {
    console.log(`ℹ️  Past games still 'published' (NOT billed — June is Todd's job to mark played):`);
    for (const g of pastPublished) {
      const raw = g.attendees.map(uidOf).filter(Boolean).length;
      console.log(`   ${g.ld}  ${g.id}  raw ${raw}/${g.max}  "${g.address}"`);
    }
    console.log('');
  }

  const billable = games.filter(g => g.status === 'played' && g.ld && g.ld >= PERIOD_START);

  let aprNew = 0, aprRec = 0, mayFull = 0, mayNotFull = 0, mayNew = 0;
  const lines = [];

  for (const g of billable) {
    const rawCount = g.attendees.map(uidOf).filter(Boolean).length; // incl. Todd slots -> for "full"
    const isFull = g.max ? rawCount >= g.max - 2 : false; // missing <=2 players counts as full
    const distinctPlayers = [...new Set(g.attendees.map(uidOf).filter(u => u && u !== TODD_UID))];

    let newCount = 0, recCount = 0;
    for (const uid of distinctPlayers) {
      if (firstSeenGameId[uid] === g.id) newCount++; else recCount++;
    }

    const isOld = g.ld < NEW_MODEL_START;
    let pay = 0, detail = '';
    if (isOld) {
      pay = 15 * newCount + 10 * recCount;
      aprNew += newCount; aprRec += recCount;
      detail = `OLD ${newCount}n*15 + ${recCount}r*10`;
    } else {
      const matchPay = isFull ? 50 : 0;
      pay = matchPay + 15 * newCount;
      if (isFull) mayFull++; else mayNotFull++;
      mayNew += newCount;
      detail = `NEW ${isFull ? '$50 FULL' : '$0 not-full'} + ${newCount}n*15`;
    }
    lines.push({ ld: g.ld, id: g.id, raw: rawCount, max: g.max, isFull, newCount, recCount, pay, detail, model: isOld ? 'OLD' : 'NEW', address: g.address });
  }

  console.log(`Billable played games (LA date >= ${PERIOD_START}): ${billable.length}\n`);
  console.log('Date        raw/max  full  new  rec   pay   detail');
  let total = 0;
  for (const l of lines) {
    total += l.pay;
    console.log(`${l.ld}  ${String(l.raw).padStart(3)}/${String(l.max).padStart(2)}   ${l.isFull ? 'Y' : '.'}    ${String(l.newCount).padStart(2)}   ${String(l.recCount).padStart(2)}  $${String(l.pay).padStart(4)}  ${l.detail}`);
  }

  const aprT = lines.filter(l => l.model === 'OLD').reduce((s, l) => s + l.pay, 0);
  const mayT = lines.filter(l => l.model === 'NEW').reduce((s, l) => s + l.pay, 0);
  const aprG = lines.filter(l => l.model === 'OLD').length;
  const mayG = lines.filter(l => l.model === 'NEW').length;

  console.log('\n========== SUMMARY ==========');
  console.log(`\nOLD model (Apr 16 - May 31): ${aprG} games`);
  console.log(`  new:       ${aprNew} x $15 = $${aprNew * 15}`);
  console.log(`  recurring: ${aprRec} x $10 = $${aprRec * 10}`);
  console.log(`  subtotal:  $${aprT}`);
  console.log(`\nNEW model (Jun 1+): ${mayG} games  (${mayFull} full / ${mayNotFull} not full)`);
  console.log(`  full matches: ${mayFull} x $50 = $${mayFull * 50}`);
  console.log(`  new:          ${mayNew} x $15 = $${mayNew * 15}`);
  console.log(`  subtotal:     $${mayT}`);
  console.log(`\n>>> TOTAL DUE: $${total} USD  (~€${(total / RATE).toFixed(2)} at 1.17) <<<\n`);

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
