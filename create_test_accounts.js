/**
 * Poteau | create_test_accounts.js
 *
 * Provisions the Kinshasa-anchored test accounts used by the agent UI-testing
 * system. Clones the shape of real user docs (READ-ONLY on the templates),
 * scrubs every field that links back to a real person / RevenueCat customer /
 * real game, anchors everything in Kinshasa, and stamps is_test_account: true.
 *
 * SAFETY:
 *   - Dry-run by DEFAULT. Prints exactly what it would create. Writes nothing.
 *   - Pass --live to actually create Auth users + Firestore docs.
 *   - Idempotent: if an Auth user with the same email already exists, the
 *     account is SKIPPED (never delete-and-recreate — that's destructive).
 *   - Never mutates the template docs.
 *
 * Usage:
 *   node create_test_accounts.js            # dry-run (default)
 *   node create_test_accounts.js --dry-run  # explicit dry-run
 *   node create_test_accounts.js --live     # actually provision
 *   node create_test_accounts.js --live --only marc_organizer,sophie_joiner
 *
 * Teardown is handled separately by teardown.sh / delete_test_accounts.js.
 */

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
const cfg = require(path.join(__dirname, 'agent', 'lib', 'kinshasa_test_config.js'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const auth = admin.auth();
const { FieldValue, GeoPoint, Timestamp } = admin.firestore;

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const LIVE = argv.includes('--live');
const DRY = !LIVE; // dry-run unless explicitly --live
const onlyArg = (argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] ||
  (argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : '');
const ONLY = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;

// ---------------------------------------------------------------------------
// Field scrub policy (derived from recon 2026-07-08).
// ---------------------------------------------------------------------------

// Fields DROPPED entirely from the clone — RevenueCat plumbing (real customer
// IDs) + any server-managed identity that must not be carried over.
const DROP_FIELDS = new Set([
  'aliases', 'entitlements', 'subscriptions', 'non_subscriptions', 'other_purchases',
  'original_app_user_id', 'original_application_version', 'original_purchase_date',
  'management_url', 'geoHash', 'first_seen', 'last_seen',
]);

// Cross-reference / stateful arrays reset to [].
const EMPTY_ARRAY_FIELDS = [
  'friends', 'pending_friends', 'blocked_users',
  'positive_reports', 'rude_reports', 'no_show_reports', 'late_reports',
  'games', 'played_games', 'upcoming_games', 'pending_feedback', 'pending_votes',
  'alerts', 'payments', 'favorite_centres', 'last_locations', 'most_used_emojis',
  'proInvoices', 'accounts',
];

// DocRef fields pointing at real docs → null.
const NULL_FIELDS = [
  'favorite_club', 'favorite_selection',
  'latest_padel_quiz_id', 'latest_soccer_quiz_id',
];

// Timestamp/activity fields wiped so the account reads as brand-new.
const WIPE_TIMESTAMP_FIELDS = [
  'last_activity_date', 'last_played_date', 'last_organized_date',
  'last_push_date', 'last_email_date', 'last_gold_date',
];

// ---------------------------------------------------------------------------
// Build one test-user doc from a template.
// ---------------------------------------------------------------------------
function buildUserDoc(templateData, spec, uid, rosterIndex) {
  const d = { ...templateData }; // shallow copy of the template (read-only source untouched)

  // 1. Drop RevenueCat / server-managed fields.
  for (const f of DROP_FIELDS) delete d[f];

  // 2. Identity overrides.
  d.uid = uid;
  d.email = cfg.emailFor(spec.key);
  d.display_name = spec.displayName;
  if ('first_name' in d || spec.first) d.first_name = spec.first;
  if ('last_name' in d || spec.last) d.last_name = spec.last;
  if ('nickname' in d) d.nickname = spec.displayName;
  // Valid-but-fake DRC phone: the app gates game access behind a phone number
  // (checkPhoneNumber needs >=11 digits, >=4 unique). Never the template's real one.
  d.phone_number = cfg.phoneForIndex(rosterIndex ?? 0);
  // Non-empty generated avatar: the app's isUserComplete gate (games tab)
  // requires a non-empty photo_url. Not the template user's real photo.
  d.photo_url = cfg.photoForName(spec.displayName);
  d.hash_pic = '';
  d.language = spec.language;

  // 3. type / role.
  //   - Pros carry `type: pro`; players/ambassadors omit `type` (like real docs).
  //   - `role` is the app-level UserRoles enum. Real players have role: "player".
  //     Pros don't use it — leave it off (never set it to undefined; Firestore rejects that).
  if (spec.role === 'pro') { d.type = 'pro'; delete d.role; }
  else if (spec.role === 'super_pro') { d.type = 'super_pro'; delete d.role; }
  else { delete d.type; d.role = 'player'; } // player / ambassador

  // 4. Gold.
  d.gold_status = !!spec.gold;

  // 5. Geo → Kinshasa (set at build time, never patched afterwards).
  const K = cfg.KINSHASA;
  d.country = K.country;
  d.country_code = K.countryCode;
  d.time_zone = K.timeZone;
  if ('last_address' in d) d.last_address = K.address;
  if ('last_label' in d) d.last_label = K.label;
  if ('last_location' in d) d.last_location = new GeoPoint(K.lat, K.lng);
  if ('centres_filter' in d) d.centres_filter = false;
  d.last_radius = K.radius;
  // last_availability is a doc-id string keyed by the OLD uid+city — regenerate.
  if ('last_availability' in d) {
    d.last_availability = `${uid}_${K.city.toLowerCase()}_${K.lat.toFixed(3)}_${K.lng.toFixed(3)}`;
  }
  // availabilities struct → mark unfilled (no real slots carried over).
  if ('availabilities' in d) d.availabilities = { filled: false };

  // 6. Skill levels — set joiners to satisfy the seed game's level gates.
  Object.assign(d, cfg.TEST_JOINER_LEVELS);

  // 7. Reset stateful arrays / null out DocRefs / wipe timestamps.
  for (const f of EMPTY_ARRAY_FIELDS) if (f in d) d[f] = [];
  for (const f of NULL_FIELDS) if (f in d) d[f] = null;
  for (const f of WIPE_TIMESTAMP_FIELDS) if (f in d) d[f] = null;

  // 7b. Pro (poteau-max) centre fields → Kinshasa + scrub real venue identity.
  if (spec.role === 'pro' || spec.role === 'super_pro') {
    // A pro's `accounts` MUST contain at least its own UID (empty = no access).
    d.accounts = [uid];
    if ('centre_name' in d) d.centre_name = K.centreName;
    if ('centre_address' in d) d.centre_address = K.address;
    if ('centre_place_id' in d) d.centre_place_id = K.placeId;
    if ('centre_location' in d) d.centre_location = new GeoPoint(K.lat, K.lng);
    if ('centre_country' in d) d.centre_country = K.country;
    if ('centre_currency' in d) d.centre_currency = cfg.SEED_GAME.currency;
    d.time_zone = K.timeZone;
    // Strip real venue identity / assets / stats.
    for (const f of ['centre_poster', 'qr_code', 'short_name']) if (f in d) d[f] = '';
    if ('centre_user_first_name' in d) d.centre_user_first_name = spec.first;
    if ('centre_user_last_name' in d) d.centre_user_last_name = spec.last;
    if ('centre_ratings_count' in d) d.centre_ratings_count = 0;
    if ('centre_ratings_average' in d) d.centre_ratings_average = 0;
    if ('centre_unread_messenger' in d) d.centre_unread_messenger = 0;
    if ('followers' in d) d.followers = 0;
    if ('players' in d) d.players = 0;
  }

  // 8. Onboarding complete so the account lands straight in the app.
  //    Players use the enum string "complete"; pros use the poteau-max flow and
  //    only get the field if the template already had it.
  if (spec.role !== 'pro' && spec.role !== 'super_pro') {
    d.last_onboarding_step = 'complete';
  }
  if ('referred' in d) d.referred = false;
  if ('unread_notif' in d) d.unread_notif = 0;

  // 9. THE marker.
  d.is_test_account = true;

  // 10. Fresh created_time.
  d.created_time = LIVE ? Timestamp.now() : '<Timestamp now (live)>';

  // 11. Safety net: Firestore rejects `undefined`. Strip any that slipped
  //     through (e.g. a template field we overrode with a conditional miss).
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];

  return d;
}

// ---------------------------------------------------------------------------
// Pretty-print helper for dry-run.
// ---------------------------------------------------------------------------
function preview(v) {
  if (v === null) return 'null';
  const cn = v && v.constructor && v.constructor.name;
  if (cn === 'Timestamp') return `<Timestamp ${v.toDate().toISOString().slice(0, 10)}>`;
  if (cn === 'GeoPoint') return `<GeoPoint ${v.latitude},${v.longitude}>`;
  if (cn === 'DocumentReference') return `<DocRef ${v.path}>`;
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  return JSON.stringify(v);
}

async function emailExists(email) {
  try { return await auth.getUserByEmail(email); }
  catch (e) { if (e.code === 'auth/user-not-found') return null; throw e; }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
(async () => {
  console.log('='.repeat(70));
  console.log(`create_test_accounts.js — ${LIVE ? '\x1b[31mLIVE (will write)\x1b[0m' : '\x1b[32mDRY-RUN (no writes)\x1b[0m'}`);
  console.log('='.repeat(70));

  // Load templates once (read-only).
  const templates = {};
  for (const [name, uid] of Object.entries(cfg.TEMPLATE_UIDS)) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) throw new Error(`Template '${name}' (${uid}) not found — aborting.`);
    templates[name] = snap.data();
    console.log(`Loaded template '${name}' from ${uid} (${Object.keys(templates[name]).length} fields)`);
  }
  console.log('');

  const roster = cfg.ROSTER.filter((s) => !ONLY || ONLY.includes(s.key));
  const created = [];
  const skipped = [];

  for (const spec of roster) {
    // Canonical index in the FULL roster so phone numbers stay stable under --only.
    const rosterIndex = cfg.ROSTER.findIndex((s) => s.key === spec.key);
    const email = cfg.emailFor(spec.key);
    const existing = await emailExists(email);

    // Idempotency: skip only when BOTH the Auth user AND its Firestore doc
    // exist. If the Auth user exists but the doc is missing (e.g. a prior run
    // died between createUser and set), finish the job by writing the doc.
    if (existing) {
      const docSnap = LIVE ? await db.collection('users').doc(existing.uid).get() : { exists: true };
      if (docSnap.exists) {
        skipped.push({ email, uid: existing.uid });
        console.log(`\x1b[33mSKIP\x1b[0m  ${email} — already exists (uid ${existing.uid})`);
        continue;
      }
      console.log(`\x1b[36mREPAIR\x1b[0m ${email} — Auth user exists but Firestore doc missing; writing doc`);
      const repairDoc = buildUserDoc(templates[spec.template], spec, existing.uid, rosterIndex);
      await db.collection('users').doc(existing.uid).set(repairDoc);
      created.push({ email, uid: existing.uid, role: spec.role, gold: spec.gold, lang: spec.language });
      console.log(`\x1b[32mCREATE\x1b[0m ${email} → uid ${existing.uid} (repaired doc)`);
      continue;
    }

    // Determine the UID: in live mode we create the Auth user first to get one;
    // in dry-run we show a placeholder.
    let uid = `<new-auth-uid>`;
    if (LIVE) {
      const rec = await auth.createUser({
        email,
        emailVerified: true,           // pre-verified: agent logs in, never signs up
        displayName: spec.displayName,
        password: cfg.TEST_PASSWORD,   // Poteau login is real email+password → Home
      });
      uid = rec.uid;
    }

    const doc = buildUserDoc(templates[spec.template], spec, uid, rosterIndex);

    if (LIVE) {
      await db.collection('users').doc(uid).set(doc);
      created.push({ email, uid, role: spec.role, gold: spec.gold, lang: spec.language });
      console.log(`\x1b[32mCREATE\x1b[0m ${email} → uid ${uid} (${spec.purpose})`);
    } else {
      created.push({ email, uid, role: spec.role, gold: spec.gold, lang: spec.language });
      console.log(`\nWOULD CREATE: ${email}  (${spec.purpose})`);
      console.log(`  template=${spec.template}  role=${spec.role}  gold=${spec.gold}  lang=${spec.language}`);
      const showKeys = ['is_test_account', 'type', 'role', 'gold_status', 'country', 'country_code',
        'time_zone', 'last_location', 'last_address', 'padel_skill_level', 'soccer_skill_level',
        'last_onboarding_step', 'friends', 'games', 'availabilities', 'phone_number', 'email', 'display_name',
        'accounts', 'centre_name', 'centre_location', 'centre_place_id', 'centre_currency'];
      for (const k of showKeys) if (k in doc) console.log(`    ${k.padEnd(22)}= ${preview(doc[k])}`);
      // Confirm scrub worked:
      const leaked = [...DROP_FIELDS].filter((f) => f in doc);
      if (leaked.length) console.log(`    \x1b[31m!! LEAKED drop-fields: ${leaked.join(', ')}\x1b[0m`);
      console.log(`    (total fields in doc: ${Object.keys(doc).length})`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`SUMMARY (${LIVE ? 'LIVE' : 'DRY-RUN'}):`);
  console.log(`  ${LIVE ? 'Created' : 'Would create'}: ${created.length}`);
  console.log(`  Skipped (already exist): ${skipped.length}`);
  console.log('='.repeat(70));

  if (created.length) {
    console.log(`\n${LIVE ? 'CREATED' : 'WOULD CREATE'} accounts (uid  email  role/gold/lang):`);
    for (const c of created) console.log(`  ${c.uid.padEnd(30)} ${c.email.padEnd(40)} ${c.role}/${c.gold ? 'gold' : '-'}/${c.lang}`);
  }
  if (skipped.length) {
    console.log(`\nSKIPPED accounts:`);
    for (const s of skipped) console.log(`  ${s.uid.padEnd(30)} ${s.email}`);
  }
  if (DRY) console.log('\n\x1b[32mDry-run only. Re-run with --live to actually provision.\x1b[0m');

  process.exit(0);
})().catch((e) => { console.error('\x1b[31mERROR\x1b[0m', e); process.exit(1); });
