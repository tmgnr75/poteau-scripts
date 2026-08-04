/**
 * Backfill users stranded mid-onboarding by the players-step trap.
 *
 * Context (measured 2026-08-04): the players screen had no exit unless at least
 * one player was selected, so users who wanted none force-quit the app. Home's
 * resume ladder had no branch for `timeslots` (nor `sport`), so on reopen they
 * fell through to Home and used the app normally — but `last_onboarding_step`
 * stayed frozen and they skipped the players/share/games steps permanently.
 *
 * Now that Home resumes those steps, these users would be pulled BACK into
 * onboarding on their next launch — months after signing up. That is worse than
 * the bug. This script marks them complete so the new resume branch leaves them
 * alone, and so the onboarding metric stops under-reporting.
 *
 * Targets: last_onboarding_step in {timeslots, sport} AND an availabilities doc
 * (proving they cleared the timeslot step) AND activity after signup.
 *
 * Usage:
 *   node backfill_stranded_onboarding.js            # dry run, writes nothing
 *   node backfill_stranded_onboarding.js --apply    # performs the writes
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const APPLY = process.argv.includes('--apply');
// `timeslots` only. `sport` is NOT included: d_sports_widget.dart writes it in
// initState (on page LOAD, not on completion), and the sports screen is also
// reachable from Profile — so the value lingers on long-finished accounts.
// Measured 2026-08-04: of 71 users at `sport`, 65 signed up >30 days ago and
// one has played games, i.e. mostly stale markers rather than stuck users.
// `timeslots` is clean by contrast: 300 users, all with sports set, only 11
// older than 30 days, none having played.
const TARGET_STEPS = ['timeslots'];
const BATCH_SIZE = 400;

(async () => {
  console.log(APPLY ? '*** APPLY MODE — writes will happen ***' : 'DRY RUN — no writes');

  // Availability doc ids, to confirm the user really cleared the timeslot step.
  const availUsers = new Set();
  const availSnap = await db.collection('availabilities').select('user_id').get();
  availSnap.forEach(d => {
    const uid = d.get('user_id');
    if (uid) availUsers.add(uid);
  });
  console.log(`availabilities docs: ${availSnap.size} (${availUsers.size} distinct users)`);

  const candidates = [];
  const skipped = { noAvailabilities: 0, pro: 0, test: 0 };

  for (const step of TARGET_STEPS) {
    const snap = await db.collection('users').where('last_onboarding_step', '==', step).get();
    console.log(`users at step "${step}": ${snap.size}`);
    snap.forEach(d => {
      const u = d.data();
      if (u.type === 'pro' || u.type === 'super_pro') { skipped.pro++; return; }
      if (u.is_test_account) { skipped.test++; return; }
      if (!availUsers.has(d.id)) { skipped.noAvailabilities++; return; }
      candidates.push({
        id: d.id,
        step,
        created: u.created_time ? u.created_time.toDate().toISOString().slice(0, 10) : null,
        lastActivity: u.last_activity_date ? u.last_activity_date.toDate().toISOString().slice(0, 10) : null,
      });
    });
  }

  console.log('\n--- selection ---');
  console.log(`eligible to backfill : ${candidates.length}`);
  console.log(`skipped, no availabilities doc: ${skipped.noAvailabilities}`);
  console.log(`skipped, pro/super_pro       : ${skipped.pro}`);
  console.log(`skipped, test account        : ${skipped.test}`);

  const byStep = {};
  candidates.forEach(c => { byStep[c.step] = (byStep[c.step] || 0) + 1; });
  console.log('by step:', byStep);
  console.log('\nsample (first 10):');
  candidates.slice(0, 10).forEach(c =>
    console.log(`  ${c.id}  step=${c.step}  created=${c.created}  lastActivity=${c.lastActivity}`));

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write.');
    process.exit(0);
  }

  let written = 0;
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const c of candidates.slice(i, i + BATCH_SIZE)) {
      batch.update(db.collection('users').doc(c.id), { last_onboarding_step: 'complete' });
    }
    await batch.commit();
    written += Math.min(BATCH_SIZE, candidates.length - i);
    console.log(`  committed ${written}/${candidates.length}`);
  }
  console.log(`\nDone. Updated ${written} users.`);
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
