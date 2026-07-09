/**
 * Poteau | teardown_test_accounts.js
 *
 * Reverses everything create_test_accounts.js + seed_kinshasa_games.js created:
 *   - Deletes the 10 test Firebase Auth users + their Firestore user docs.
 *   - Deletes all is_test_game games (the seeded Kinshasa padel game + any others).
 *   - Un-flags centres@poteau.team (removes is_test_account).
 *   - Prints the CF-revert instructions (the is_test_account gates are harmless
 *     to leave deployed, but here's how to remove them if you want).
 *
 * SAFETY:
 *   - Dry-run by DEFAULT. Prints exactly what it would delete. Deletes nothing.
 *   - Pass --live to actually delete.
 *   - Only ever touches accounts whose email ends in @poteau-test.internal and
 *     games flagged is_test_game:true — never real data.
 *
 * Usage:
 *   node teardown_test_accounts.js           # dry-run
 *   node teardown_test_accounts.js --live     # actually delete
 */

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
const cfg = require(path.join(__dirname, 'agent', 'lib', 'kinshasa_test_config.js'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const auth = admin.auth();

const LIVE = process.argv.includes('--live');

// The QA pro account we flagged as is_test_account (not deleted — just un-flagged).
const QA_PRO_UID = 'zCvsukfMuuffsuPpSTQwb7MusMD2'; // centres@poteau.team

(async () => {
  console.log('='.repeat(70));
  console.log(`teardown_test_accounts.js — ${LIVE ? '\x1b[31mLIVE (will delete)\x1b[0m' : '\x1b[32mDRY-RUN\x1b[0m'}`);
  console.log('='.repeat(70));

  // --- 1. Test accounts (Auth + Firestore) ---
  console.log('\n[1] Test accounts (@' + cfg.TEST_EMAIL_DOMAIN + '):');
  let acctDeleted = 0;
  for (const spec of cfg.ROSTER) {
    const email = cfg.emailFor(spec.key);
    const u = await auth.getUserByEmail(email).catch(() => null);
    if (!u) { console.log(`  (absent) ${email}`); continue; }
    // Safety assertion: never delete a non-test email.
    if (!cfg.isTestEmail(u.email)) { console.log(`  \x1b[31mSKIP non-test email ${u.email}\x1b[0m`); continue; }
    if (LIVE) {
      await db.collection('users').doc(u.uid).delete();
      await auth.deleteUser(u.uid);
      console.log(`  \x1b[32mDELETED\x1b[0m ${email} (${u.uid})`);
    } else {
      console.log(`  would delete ${email} (${u.uid}) — Auth user + users/${u.uid}`);
    }
    acctDeleted++;
  }

  // --- 2. Test games (is_test_game:true) ---
  console.log('\n[2] Test games (is_test_game == true):');
  const gamesSnap = await db.collection('games').where('is_test_game', '==', true).get();
  let gameDeleted = 0;
  for (const g of gamesSnap.docs) {
    const d = g.data();
    if (LIVE) {
      await g.ref.delete();
      console.log(`  \x1b[32mDELETED\x1b[0m games/${g.id} (${d.centre})`);
    } else {
      console.log(`  would delete games/${g.id} (${d.centre}, ${d.sport}, ${d.status})`);
    }
    gameDeleted++;
  }
  if (!gamesSnap.size) console.log('  (none)');

  // --- 3. Un-flag centres@poteau.team ---
  console.log('\n[3] Un-flag QA pro account (centres@poteau.team):');
  const qa = await db.collection('users').doc(QA_PRO_UID).get();
  if (qa.exists && qa.data().is_test_account === true) {
    if (LIVE) {
      await qa.ref.update({ is_test_account: admin.firestore.FieldValue.delete() });
      console.log(`  \x1b[32mUN-FLAGGED\x1b[0m ${QA_PRO_UID} (removed is_test_account)`);
    } else {
      console.log(`  would remove is_test_account from ${QA_PRO_UID}`);
    }
  } else {
    console.log(`  (already not flagged)`);
  }

  // --- 4. CF revert instructions (manual — leaving them deployed is harmless) ---
  console.log('\n[4] Cloud Function is_test_account gates:');
  console.log('  These are harmless to leave deployed (they only ever fire for');
  console.log('  is_test_account recipients / is_test_game games, which will no');
  console.log('  longer exist after teardown). To remove them entirely:');
  console.log('    cd cloud-functions && git revert 6c1d8f4 && \\');
  console.log('      firebase deploy --only functions:createGameInvitations,\\');
  console.log('      functions:onCreateGameInvitation,functions:sendPushNotification,\\');
  console.log('      functions:sendEmailThroughAWS --project krank-club');
  console.log('  (Then commit + push the revert, per the workspace rule.)');

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY (${LIVE ? 'LIVE' : 'DRY-RUN'}): ${acctDeleted} accounts, ${gameDeleted} games ${LIVE ? 'deleted' : 'to delete'}.`);
  if (!LIVE) console.log('\x1b[32mDry-run only. Re-run with --live to delete.\x1b[0m');
  console.log('='.repeat(70));
  process.exit(0);
})().catch((e) => { console.error('\x1b[31mERROR\x1b[0m', e); process.exit(1); });
