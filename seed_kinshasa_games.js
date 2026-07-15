/**
 * Poteau | seed_kinshasa_games.js
 *
 * Seeds the joinable in-app padel game the UI-testing agent will join. Cloned
 * in SHAPE from a real recent in-app padel game (11Ak8ZabRpYMc6ldRivE, 4PADEL
 * Montreuil) but built Kinshasa-anchored from the start and fully scrubbed of
 * anything linking back to the original (organizer, centre, place_id, address,
 * attendees, payments, reservation name).
 *
 * SAFETY:
 *   - Dry-run by DEFAULT. Pass --live to write.
 *   - Idempotent: tags the game with is_test_game:true + organizer is a test
 *     account. Skips creation if an OPEN test game already exists for the
 *     organizer (won't spam duplicates). Pass --force to create anyway.
 *   - Marks the doc is_test_game:true so teardown.sh can find + delete it.
 *
 * Usage:
 *   node seed_kinshasa_games.js            # dry-run
 *   node seed_kinshasa_games.js --live     # create the game
 *   node seed_kinshasa_games.js --live --force
 *
 * The game date defaults to +3 days at 18:00 Kinshasa time. Override with
 * --days=N.
 */

const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
const cfg = require(path.join(__dirname, 'agent', 'lib', 'kinshasa_test_config.js'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();
const { GeoPoint, Timestamp } = admin.firestore;

const argv = process.argv.slice(2);
const LIVE = argv.includes('--live');
const FORCE = argv.includes('--force');
const daysArg = (argv.find((a) => a.startsWith('--days=')) || '').split('=')[1];
const DAYS_AHEAD = daysArg ? parseInt(daysArg, 10) : 3;
const profileArg = (argv.find((a) => a.startsWith('--profile=')) || '').split('=')[1] ||
  (argv.includes('--profile') ? argv[argv.indexOf('--profile') + 1] : '');

// The organizer test account (owns the game). Resolved from the roster.
const ORGANIZER_KEY = 'marc_organizer';

// ---------------------------------------------------------------------------
// Timeline PROFILES — position the game's `date` relative to now so a specific
// V5 payment phase is exercised. All offsets are relative to remove_reserved_hours
// (RRH = 5h in prod today; see reference_v5_payment_model). The join path is:
//   date - now  >  RRH  → Path 1: free reservation, spot "reserved", NO PaymentSheet
//   date - now  <= RRH  → Path 2: PaymentSheet opens, hold placed, spot "confirmed"
//   capture/cancel happens at T-1h (handlePaymentAuth); sweep at T-RRH (unreserveSpots)
//
// Profiles (offset from now, in hours):
//   far-out        +168h (7d)   — comfortably in Path 1; free reservation
//   confirm-window +6h          — still Path 1 today (>5h) but close to the RRH sweep boundary
//   near-removal   +5.5h        — just OUTSIDE RRH; about to enter the unreserveSpots sweep window
//   authorize-now  +4h          — INSIDE RRH → Path 2: joining opens the Stripe PaymentSheet
//   last-minute    +0.75h (45m) — < T-1h capture window; immediate/late behavior
//
// NOTE: today RRH=5h so "near-removal" and "authorize-now" are ~an hour apart. Post-V5
// (RRH=120h) these profiles still make sense proportionally; adjust offsets if RRH changes.
// ---------------------------------------------------------------------------
// NOTE on far-out: the discovery feed only browses a limited date window
// (day-tabs span ~the next few days), so a +7d game is hard for the agent to
// reach. What "far-out" actually tests is Path 1 (free reservation, no
// PaymentSheet), which triggers for ANY game > remove_reserved_hours (5h) out.
// +40h (~1.7 days) is comfortably Path 1 AND stays inside the browsable range.
const PROFILE_OFFSET_HOURS = {
  'far-out': 40,
  'confirm-window': 6,
  'near-removal': 5.5,
  'authorize-now': 4,
  'last-minute': 0.75,
};

// 'default' (and no profile) → the legacy standing game (~3 days out).
const isDefaultProfile = !profileArg || profileArg === 'default';

// Compute game start/end as an offset-from-now (profile) OR the legacy day-ahead 18:00 slot.
function kinshasaGameTimes() {
  const now = new Date();
  if (profileArg && !isDefaultProfile) {
    const offH = PROFILE_OFFSET_HOURS[profileArg];
    if (offH === undefined) {
      throw new Error(`Unknown --profile "${profileArg}". Valid: default, ${Object.keys(PROFILE_OFFSET_HOURS).join(', ')}`);
    }
    const start = new Date(now.getTime() + offH * 3600 * 1000);
    const end = new Date(start.getTime() + cfg.SEED_GAME.duration * 60 * 1000);
    return { start, end };
  }
  // Legacy: DAYS_AHEAD days out at 18:00 Kinshasa (17:00 UTC).
  const d = new Date(now.getTime() + DAYS_AHEAD * 24 * 3600 * 1000);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 17, 0, 0, 0));
  const end = new Date(start.getTime() + cfg.SEED_GAME.duration * 60 * 1000);
  return { start, end };
}

function buildGameDoc(organizerUid) {
  const K = cfg.KINSHASA;
  const S = cfg.SEED_GAME;
  const { start, end } = kinshasaGameTimes();
  const organizerRef = db.collection('users').doc(organizerUid);

  return {
    // --- kept from the real template shape ---
    sport: S.sport,
    payment_type: S.paymentType,
    currency: S.currency,
    price: S.price,
    price_undiscounted: S.priceUndiscounted,
    max_players: S.maxPlayers,
    players_to_find: S.playersToFind,
    duration: S.duration,
    mood: S.mood,
    type: S.type,
    visibility: S.visibility,
    gold_exclusive: S.goldExclusive,
    level_deltas: S.levelDeltas,
    description: S.description,
    payment_link: '',
    interested: [],

    // --- scrubbed → Kinshasa, set at creation (never patched afterwards) ---
    location: new GeoPoint(K.lat, K.lng),
    place_id: K.placeId,           // synthetic 'test_kinshasa_padel_01'
    // Profile-distinct name so multiple concurrent test games (and the agent)
    // can tell them apart. 'Kinshasa Padel Test' for default; suffixed otherwise.
    centre: isDefaultProfile ? K.centreName : `${K.centreName} [${profileArg}]`,
    address: K.address,
    country_code: K.countryCode,   // 'CD'
    time_zone: K.timeZone,         // 'Africa/Kinshasa'
    reservation_name: 'Marc Test', // not 'Axel Metzger'

    // --- dates (future so the game is joinable) ---
    date: LIVE ? Timestamp.fromDate(start) : `<Timestamp ${start.toISOString()}>`,
    end_time: LIVE ? Timestamp.fromDate(end) : `<Timestamp ${end.toISOString()}>`,
    created_on: LIVE ? Timestamp.now() : '<Timestamp now>',

    // --- organizer = test account (drives discovery isolation) ---
    organizer: organizerUid,       // stored as UID string, like the template
    attendees: [organizerRef],     // only the organizer so far
    payments: [],                  // NO real payment docs

    // --- teams: slot 1 confirmed for organizer, 3 OPEN for the agent to join ---
    teams: [
      { team_side: 'team_a', status: 'confirmed', user_id: organizerUid, plus_one: false },
      { team_side: 'team_a', status: 'open' },
      { team_side: 'team_b', status: 'open' },
      { team_side: 'team_b', status: 'open' },
    ],

    // --- must be live/joinable ---
    status: 'published',

    // --- test markers (teardown + CF isolation belt-and-suspenders) ---
    is_test_game: true,
    test_profile: profileArg || 'default',
  };
}

function preview(v) {
  if (v === null) return 'null';
  const cn = v && v.constructor && v.constructor.name;
  if (cn === 'GeoPoint') return `<GeoPoint ${v.latitude},${v.longitude}>`;
  if (cn === 'DocumentReference') return `<DocRef ${v.path}>`;
  if (Array.isArray(v)) return JSON.stringify(v).slice(0, 90);
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 90);
  return JSON.stringify(v);
}

(async () => {
  console.log('='.repeat(70));
  console.log(`seed_kinshasa_games.js — ${LIVE ? '\x1b[31mLIVE\x1b[0m' : '\x1b[32mDRY-RUN\x1b[0m'}`);
  console.log('='.repeat(70));

  // Resolve organizer UID from the roster (via Auth email lookup — stable).
  const organizerEmail = cfg.emailFor(ORGANIZER_KEY);
  const auth = admin.auth();
  const organizer = await auth.getUserByEmail(organizerEmail).catch(() => null);
  if (!organizer) {
    throw new Error(`Organizer ${organizerEmail} not found. Run create_test_accounts.js --live first.`);
  }
  console.log(`Organizer: ${organizerEmail} → ${organizer.uid}\n`);

  // Idempotency: is there already an open test game for this organizer WITH THE
  // SAME profile? Different profiles are distinct fixtures, so we don't skip
  // across profiles. (Filter profile client-side to avoid a composite index.)
  if (!FORCE) {
    const existingSnap = await db.collection('games')
      .where('organizer', '==', organizer.uid)
      .where('is_test_game', '==', true)
      .where('status', '==', 'published')
      .get();
    const wantProfile = profileArg || 'default';
    const existing = { docs: existingSnap.docs.filter((d) => (d.data().test_profile || 'default') === wantProfile) };
    existing.empty = existing.docs.length === 0;
    existing.size = existing.docs.length;
    if (!existing.empty) {
      console.log(`\x1b[33mSKIP\x1b[0m — ${existing.size} open test game(s) already exist for this organizer:`);
      existing.forEach((d) => {
        const g = d.data();
        const dt = g.date && g.date.toDate ? g.date.toDate().toISOString() : g.date;
        console.log(`  games/${d.id}  date=${dt}  status=${g.status}`);
      });
      console.log('\nUse --force to create another anyway.');
      process.exit(0);
    }
  }

  const doc = buildGameDoc(organizer.uid);

  if (LIVE) {
    const ref = await db.collection('games').add(doc);
    // Link the game onto the organizer's user doc (games array + upcoming_games),
    // mirroring what the app does when you create a game.
    await db.collection('users').doc(organizer.uid).update({
      games: admin.firestore.FieldValue.arrayUnion(ref),
      upcoming_games: admin.firestore.FieldValue.arrayUnion(ref),
    });
    console.log(`\x1b[32mCREATED\x1b[0m games/${ref.id}`);
    console.log(`  Linked onto organizer's games[] + upcoming_games[].`);
    console.log(`\n  Game ID: ${ref.id}`);
    console.log(`  Joinable via the 3 open team slots. Date: ${doc.date.toDate().toISOString()}`);
  } else {
    console.log('WOULD CREATE game in collection "games":\n');
    for (const k of Object.keys(doc)) console.log(`  ${k.padEnd(20)}= ${preview(doc[k])}`);
    console.log(`\n  (${Object.keys(doc).length} fields)`);
    console.log('\n\x1b[32mDry-run only. Re-run with --live to seed.\x1b[0m');
  }

  process.exit(0);
})().catch((e) => { console.error('\x1b[31mERROR\x1b[0m', e); process.exit(1); });
