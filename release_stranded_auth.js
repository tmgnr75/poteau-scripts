// Release a Stripe authorization held by someone who is on no roster.
//
// WHY THIS IS A SCRIPT AND NOT A CLOUD FUNCTION. removePlayer is the only code
// path that cancels an authorization, and it can only run for someone who is ON
// the game. A player stranded by the 2026-09-14 attendees bug is on no roster,
// so there is no in-product way to give them their money back: the hold just
// sits until Stripe lapses it (~7 days) or the game resolves.
//
// ORDER MATTERS: STRIPE FIRST, FIRESTORE SECOND. Never write a Firestore status
// that Stripe has not confirmed. We retrieve the PaymentIntent, check it really
// is an uncaptured hold for the amount we expect, cancel it, and only then
// mirror `canceled` into the payment doc. If Stripe refuses, Firestore is left
// untouched and the doc still says `authorized` -- which is the truth.
//
// Usage:
//   source ~/.poteau/stripe.env && node release_stranded_auth.js <paymentDocId>          # dry run
//   source ~/.poteau/stripe.env && node release_stranded_auth.js <paymentDocId> --write   # cancels
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa    = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const PAYMENT_ID = process.argv[2];
const WRITE = process.argv.includes('--write');

if (!PAYMENT_ID) {
  console.error('usage: release_stranded_auth.js <paymentDocId> [--write]');
  process.exit(1);
}

const KEY = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;
if (!KEY) {
  console.error('Missing STRIPE_SECRET in the environment.');
  console.error('Run:  source ~/.poteau/stripe.env');
  process.exit(1);
}

async function stripeCall(path, method = 'GET') {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}` },
  });
  const body = await res.json();
  if (body.error) throw new Error(`Stripe: ${body.error.message}`);
  return body;
}

(async () => {
  const snap = await db.collection('payments').doc(PAYMENT_ID).get();
  if (!snap.exists) { console.error(`payment ${PAYMENT_ID} not found`); process.exit(1); }
  const d = snap.data();

  const game = d.game_ref ? await d.game_ref.get() : null;
  const gd = game && game.exists ? game.data() : {};
  const user = d.user_ref ? await d.user_ref.get() : null;
  const ud = user && user.exists ? user.data() : {};
  const attendees = (gd.attendees || []).map(r => r && r.id).filter(Boolean);
  const onRoster = d.user_ref ? attendees.includes(d.user_ref.id) : false;

  console.log('=== PAYMENT ===');
  console.log(`  doc        : ${PAYMENT_ID}`);
  console.log(`  firestore  : ${d.status}  ${d.amount}${d.currency}  spots=${d.spots || 1}`);
  console.log(`  authorized : ${d.authorization_date && d.authorization_date.toDate().toISOString()}`);
  console.log(`  user       : ${ud.display_name || '?'} (${d.user_ref && d.user_ref.id})`);
  console.log(`  game       : ${game && game.id} ${gd.centre || ''} price=${gd.price}${gd.currency || ''} status=${gd.status}`);
  console.log(`  kickoff    : ${gd.date && gd.date.toDate().toISOString()}`);
  console.log(`  attendees  : ${attendees.length}/${gd.max_players}   payer on roster: ${onRoster ? 'YES' : 'NO'}`);

  // SAFETY 1: only ever release someone who is NOT on the roster. A player who
  // is on the game has a seat, and cancelling their hold would take it away
  // without telling them.
  if (onRoster) {
    console.error('\nREFUSING: this payer IS on the roster. Releasing their hold would strip a seat they hold.');
    process.exit(2);
  }

  // SAFETY 2: Firestore must say `authorized`. Anything else (captured,
  // late_unapply, canceled) is a different situation with a different remedy.
  if (d.status !== 'authorized') {
    console.error(`\nREFUSING: payment status is "${d.status}", not "authorized".`);
    process.exit(2);
  }

  const pi = await stripeCall(`payment_intents/${d.payment_intent_id}`);
  console.log('\n=== LIVE STRIPE ===');
  console.log(`  id               : ${pi.id}`);
  console.log(`  status           : ${pi.status}`);
  console.log(`  amount           : ${pi.amount} ${String(pi.currency).toUpperCase()} (minor units)`);
  console.log(`  amount_capturable: ${pi.amount_capturable}`);
  console.log(`  amount_received  : ${pi.amount_received}`);

  // SAFETY 3: Stripe is the authority. Only an uncaptured hold can be released.
  if (pi.status !== 'requires_capture') {
    console.error(`\nREFUSING: Stripe says "${pi.status}", not "requires_capture". Nothing to release.`);
    if (pi.status === 'succeeded') console.error('This money has already MOVED — a refund is a different decision.');
    process.exit(2);
  }

  // SAFETY 4: the amounts must agree, or we are looking at the wrong thing.
  const expected = Math.round((d.amount || 0) * 100);
  if (pi.amount !== expected) {
    console.error(`\nREFUSING: Stripe amount ${pi.amount} != Firestore ${expected} (minor units).`);
    process.exit(2);
  }

  if (!WRITE) {
    console.log(`\nDRY RUN — would cancel ${pi.id} (${d.amount}${d.currency}) and set the payment doc to "canceled".`);
    console.log('Re-run with --write to do it.');
    process.exit(0);
  }

  console.log(`\ncancelling ${pi.id} ...`);
  const canceled = await stripeCall(`payment_intents/${pi.id}/cancel`, 'POST');
  console.log(`  Stripe now says: ${canceled.status}`);

  if (canceled.status !== 'canceled') {
    console.error('Stripe did not report "canceled" — leaving Firestore untouched.');
    process.exit(3);
  }

  await snap.ref.update({
    status: 'canceled',
    released_reason: 'stranded_by_attendees_bug_2026_09_14',
    released_at: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`  payment doc ${PAYMENT_ID} -> canceled`);
  console.log('\nDone. The hold is released; no money moved.');
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
