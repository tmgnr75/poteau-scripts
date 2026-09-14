// Watch the paid-join path after the 2026-09-14 attendees fix.
//
// THE BUG THIS WATCHES FOR. syncPaymentAndSpots used to write `teams` and not
// `attendees`. updateTeamsAttendees reads `attendees` as the source of truth,
// so an empty roster read as "everyone left" and it reset every spot -- erasing
// a seat somebody had just paid for. The payer then existed on no roster, so
// removePlayer (the ONLY path that releases a Stripe authorization) was
// unreachable, and their hold sat live until the game resolved. Nothing
// alerted, because PAYMENT_STRANDED lives in removePlayer and was never hit.
//
// Answers four questions per run:
//   1. Is anyone holding a live authorization while off the roster? (the bug)
//   2. Did the new guard have to block a roster reset? (the bug, caught)
//   3. Did anyone gain a phantom +1? (the FIX going wrong -- see below)
//   4. Are paid joins landing on the roster at all? (the fix working)
//
// QUESTION 3 IS THE ONE THAT MATTERS MOST. The fix adds the payer to
// `attendees`, and a repeated DocumentReference IS a +1 in this schema. If the
// shortfall arithmetic is ever wrong, users silently acquire guests who occupy
// real spots and inflate attendees.length -- which is what handlePaymentAuth
// reads to choose CAPTURE vs CANCEL. A phantom +1 can therefore CHARGE A WHOLE
// GAME that never actually filled. That is why this runs hourly and posts even
// when green.
//
// Read-only. Safe to run repeatedly.
const admin = require('/Users/tmgnr/node_modules/firebase-admin');
const sa    = require('/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const { execSync } = require('child_process');

// --- Slack: #health-reports -------------------------------------------------
// The webhook is bound to that one channel (a webhook cannot be retargeted).
// Posts every run so the quiet runs are evidence too, not just the alarms.
function postToSlack(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) { console.log('\n(SLACK_WEBHOOK_URL not set - not posted)'); return; }
  try {
    execSync(
      `curl -sS -X POST -H 'Content-type: application/json' ` +
      `--data ${JSON.stringify(JSON.stringify({ text }))} ${JSON.stringify(url)}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    console.log('\nposted to #health-reports');
  } catch (e) {
    console.log('\n(Slack post failed)');
  }
}

const SINCE_MIN = Number(process.argv[2] || 60);

// The fix ships at deploy time; set this to the deploy moment so pre-existing
// strandings are labelled rather than counted against it. Othmane's 11 Sept
// authorization is pre-fix and must not make every run red forever -- the same
// cry-wolf trap the publishGame monitor hit with its 175 legacy games.
const FIX_LIVE = new Date(process.env.PAID_ROSTER_FIX_LIVE || '2026-09-14T12:00:00Z');

function readLog(filter, limit = 200) {
  try {
    const out = execSync(
      `gcloud logging read ${JSON.stringify(filter)} --project=krank-club ` +
      `--limit=${limit} --format=json`,
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] }
    );
    return JSON.parse(out || '[]');
  } catch (e) {
    return null; // distinguishable from "no hits"
  }
}

(async () => {
  const since = new Date(Date.now() - SINCE_MIN * 60 * 1000);
  const sinceIso = since.toISOString();

  // --- 1. Live authorizations held by someone off the roster ----------------
  // The actual harm. A hold on a game you are not on cannot be released by you.
  const authorized = await db.collection('payments').where('status', '==', 'authorized').get();
  const stranded = [];
  let onRoster = 0;
  for (const p of authorized.docs) {
    const d = p.data();
    if (!d.game_ref || !d.user_ref) continue;
    const g = await d.game_ref.get();
    if (!g.exists) continue;
    const gd = g.data();
    const att = (gd.attendees || []).map(r => r && r.id).filter(Boolean);
    if (att.includes(d.user_ref.id)) { onRoster++; continue; }

    const kick = gd.date && gd.date.toDate ? gd.date.toDate() : null;
    // A cancelled/played game's hold lapses on Stripe's side; only a live game
    // can still take someone's money for a seat they do not have.
    const live = gd.status === 'published' && kick && kick > new Date();
    const authAt = d.authorization_date && d.authorization_date.toDate
      ? d.authorization_date.toDate() : null;
    stranded.push({
      id: p.id,
      amount: d.amount,
      currency: d.currency,
      gameId: g.id,
      centre: gd.centre || '',
      status: gd.status,
      live,
      preFix: authAt ? authAt < FIX_LIVE : true,
      userId: d.user_ref.id,
      kick,
    });
  }
  const strandedNew = stranded.filter(s => !s.preFix);
  const strandedLive = stranded.filter(s => s.live);

  // --- 2. Phantom +1s: more attendee entries than paid spots ----------------
  // The fix going wrong. Only in-app games can have this shape, and only for
  // users with payments -- an organizer's own repeated ref is a real +1.
  const recentGames = await db.collection('games')
    .where('created_on', '>=', new Date(Date.now() - 14 * 24 * 3600 * 1000))
    .get();
  const phantom = [];
  for (const g of recentGames.docs) {
    const gd = g.data();
    if (gd.payment_type !== 'in-app') continue;
    const att = (gd.attendees || []).map(r => r && r.id).filter(Boolean);
    if (!att.length) continue;
    const counts = att.reduce((m, id) => (m[id] = (m[id] || 0) + 1, m), {});
    const dupes = Object.entries(counts).filter(([, n]) => n > 1);
    if (!dupes.length) continue;

    for (const [uid, n] of dupes) {
      const pays = await db.collection('payments')
        .where('user_ref', '==', db.collection('users').doc(uid))
        .where('game_ref', '==', g.ref)
        .where('status', 'in', ['captured', 'authorized'])
        .get();
      const paidSpots = pays.docs.reduce((s, d) => s + (d.data().spots || 1), 0);
      // Paid for fewer spots than they occupy: someone got a free seat, or the
      // shortfall maths double-counted them.
      if (paidSpots > 0 && n > paidSpots) {
        phantom.push({ gameId: g.id, centre: gd.centre || '', uid, entries: n, paidSpots });
      }
    }
  }

  // --- 3. The new guard firing (the bug, caught before it bit) --------------
  const blocked = readLog(
    `timestamp>="${sinceIso}" AND jsonPayload.code="ROSTER_RESET_BLOCKED_PAID_SPOT"`
  );
  const logFailed = blocked === null;
  const blockedCount = logFailed ? 0 : blocked.length;

  // --- 4. Paid joins landing on the roster (the fix working) ---------------
  const created = readLog(
    `timestamp>="${sinceIso}" AND textPayload:"CREATED new confirmed spot"`, 100
  );
  const added = readLog(
    `timestamp>="${sinceIso}" AND textPayload:"Transaction: attendees"`, 100
  );
  const createdCount = created === null ? 0 : created.length;
  const addedCount = added === null ? 0 : added.length;

  // --- Names, because a uid is not a person --------------------------------
  const nameById = {};
  const uids = [...new Set([...strandedLive.map(s => s.userId), ...phantom.map(p => p.uid)])];
  for (const uid of uids) {
    try {
      const u = await db.collection('users').doc(uid).get();
      nameById[uid] = u.exists ? (u.data().display_name || uid.slice(0, 6)) : uid.slice(0, 6);
    } catch (e) {
      nameById[uid] = uid.slice(0, 6);
    }
  }

  console.log(`authorized payments: ${authorized.size} (on roster ${onRoster}, stranded ${stranded.length})`);
  console.log(`  stranded since fix: ${strandedNew.length}  |  on a LIVE game: ${strandedLive.length}`);
  console.log(`phantom +1s: ${phantom.length}  |  guard blocks: ${blockedCount}  |  spots created: ${createdCount}  |  attendee adds: ${addedCount}`);

  // --- Grading --------------------------------------------------------------
  // A phantom +1 is the worst outcome: it can make an unfilled game capture.
  // A stranding on a live game is next: someone's money is held for nothing.
  // The guard firing is NOT bad news -- it means the second net caught what the
  // first one missed -- but it must never be silent.
  const ok = phantom.length === 0 && strandedNew.length === 0 && !logFailed;

  let icon, headline;
  if (logFailed)                  { icon = ':white_circle:';        headline = 'state unknown'; }
  else if (phantom.length > 0)    { icon = ':red_circle:';          headline = `${phantom.length} phantom +1`; }
  else if (strandedLive.length > 3) { icon = ':red_circle:';        headline = `${strandedLive.length} holds on live games`; }
  else if (strandedLive.length > 1) { icon = ':large_orange_circle:'; headline = `${strandedLive.length} holds on live games`; }
  else if (strandedLive.length === 1) { icon = ':large_yellow_circle:'; headline = '1 hold on a live game'; }
  else if (blockedCount > 0)      { icon = ':large_yellow_circle:'; headline = `guard blocked ${blockedCount}`; }
  else if (!ok)                   { icon = ':large_orange_circle:'; headline = 'needs a look'; }
  else                            { icon = ':large_green_circle:';  headline = 'paid joins on the roster'; }

  const lines = [
    `${icon} *paid-roster monitor* · ${headline} · last ${SINCE_MIN} min`,
    `Paid spots created: *${createdCount}*  |  attendee adds: *${addedCount}*  |  ` +
      `live holds: *${authorized.size}* (off-roster *${stranded.length}*)`,
  ];

  if (logFailed) {
    lines.push('*Could not read Cloud Logging* - guard activity unknown this window (check gcloud auth).');
  }

  if (phantom.length > 0) {
    lines.push('*Phantom +1 - somebody occupies more spots than they paid for:*');
    phantom.forEach(p => lines.push(
      `• *${nameById[p.uid] || p.uid}* ${p.entries} entries, ${p.paidSpots} paid · \`${p.gameId}\` ${p.centre}`
    ));
    lines.push('_This inflates attendees.length, which decides CAPTURE vs CANCEL. Check before the next kickoff._');
  }

  if (strandedLive.length > 0) {
    lines.push('*Holding money for a seat they do not have:*');
    strandedLive.forEach(s => lines.push(
      `• *${nameById[s.userId] || s.userId}* ${s.amount}${s.currency} · \`${s.gameId}\` ${s.centre}` +
      `${s.preFix ? ' _(pre-fix)_' : ''}`
    ));
  }

  if (blockedCount > 0) {
    lines.push(`*Guard blocked ${blockedCount} roster reset${blockedCount === 1 ? '' : 's'}* - a paid spot was about to be erased.`);
  }

  if (ok) {
    const note = stranded.length > 0
      ? ` (${stranded.length} off-roster hold${stranded.length === 1 ? '' : 's'} on finished games, lapsing on Stripe's side)`
      : '';
    lines.push(`Every paid spot is on its roster${note}.`);
  }

  postToSlack(lines.join('\n'));
  process.exit(0);
})();
