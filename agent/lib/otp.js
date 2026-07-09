/**
 * Poteau agent UI-testing — OTP helper (Option A).
 *
 * Poteau's email login verifies the 4-digit code CLIENT-SIDE: the validation
 * screen compares the typed PIN against `users/<uid>.email_code` read straight
 * from Firestore (poteau-app .../email_validation/email_validation_widget.dart).
 * There is no server-side verify to bypass — so the agent driver just needs to
 * know the code that's in the doc, using the admin key.
 *
 * Two modes:
 *   - setKnownCode(uid, code): write a DETERMINISTIC code so the agent always
 *     types the same PIN. Race-free — no dependency on when/whether the app
 *     writes a fresh code. This is the DEFAULT and recommended path.
 *   - readCode(uid, {waitMs, intervalMs}): poll the doc and return whatever
 *     `email_code` the app wrote (for a more faithful "read what was emailed"
 *     flow). Falls back to null on timeout.
 *
 * The PIN field is length 4 (PinCodeTextField length: 4) and auto-submits on
 * the 4th digit, so codes are exactly 4 digits.
 *
 * This module holds the admin key — it is the ONLY place the OTP "bypass"
 * lives, scoped to a local script, exactly as intended (Option A).
 */

const admin = require('firebase-admin');
const path = require('path');

let _db = null;
function db() {
  if (!_db) {
    const serviceAccount = require(path.join(__dirname, '..', '..', 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
    }
    _db = admin.firestore();
  }
  return _db;
}

const DEFAULT_CODE = '4242'; // memorable, 4 digits

/**
 * Write a deterministic 4-digit code to the account so the agent can type it.
 * Returns the code that was set.
 */
async function setKnownCode(uid, code = DEFAULT_CODE) {
  if (!/^\d{4}$/.test(code)) throw new Error(`OTP code must be exactly 4 digits, got "${code}"`);
  await db().collection('users').doc(uid).update({ email_code: code });
  return code;
}

/**
 * Poll users/<uid>.email_code until it's a non-empty 4-digit string or timeout.
 * Use when you want the code the APP wrote (rather than setting one yourself).
 */
async function readCode(uid, { waitMs = 20000, intervalMs = 1000 } = {}) {
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const snap = await db().collection('users').doc(uid).get();
    const code = snap.exists ? snap.data().email_code : null;
    if (code && /^\d{4}$/.test(String(code))) return String(code);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/** Look up a test account's UID by its email (via Auth). */
async function uidForEmail(email) {
  if (!admin.apps.length) db(); // ensure init
  const rec = await admin.auth().getUserByEmail(email).catch(() => null);
  return rec ? rec.uid : null;
}

module.exports = { setKnownCode, readCode, uidForEmail, DEFAULT_CODE };

// ---------------------------------------------------------------------------
// CLI: the sim driver shells out to this.
//   node otp.js set   <uid|email> [code]   -> prints the code it set
//   node otp.js read  <uid|email>          -> prints the current code (polls)
// ---------------------------------------------------------------------------
if (require.main === module) {
  (async () => {
    const [, , cmd, who, arg] = process.argv;
    if (!cmd || !who) {
      console.error('Usage: node otp.js set|read <uid|email> [code]');
      process.exit(2);
    }
    const uid = who.includes('@') ? await uidForEmail(who) : who;
    if (!uid) { console.error(`No account for ${who}`); process.exit(3); }

    if (cmd === 'set') {
      const code = await setKnownCode(uid, arg || DEFAULT_CODE);
      process.stdout.write(code); // bare code on stdout for easy capture
    } else if (cmd === 'read') {
      const code = await readCode(uid);
      if (!code) { console.error('timeout: no code appeared'); process.exit(4); }
      process.stdout.write(code);
    } else {
      console.error(`Unknown command "${cmd}"`); process.exit(2);
    }
    process.exit(0);
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
