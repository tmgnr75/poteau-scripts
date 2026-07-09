/**
 * Poteau agent UI-testing — shared Kinshasa test-fixture config.
 *
 * Single source of truth imported by BOTH create_test_accounts.js and
 * seed_kinshasa_games.js so account skill levels are guaranteed to satisfy the
 * seed game's level gates, and every fixture lands in the same Kinshasa region.
 *
 * Nothing here writes to Firestore. Pure constants + tiny helpers.
 */

// ---------------------------------------------------------------------------
// Geography — Kinshasa, DRC. Chosen because Poteau has zero real users there,
// so a test account's discovery feed is naturally empty of real content and
// the is_test_account CF filters are belt-and-suspenders on top of that.
// ---------------------------------------------------------------------------
// Valid-but-fake DRC phone numbers for the test accounts. The app gates game
// access behind a profile phone number (checkPhoneNumber requires >=11 digits,
// >=4 unique). +243 is DRC. Each account gets a unique subscriber number so we
// never collide if phone uniqueness is ever enforced. index 0..9 → last digit.
const phoneForIndex = (i) => `+24381234567${i % 10}`;

// The app's `isUserComplete` gate (games tab) requires a NON-EMPTY photo_url.
// We can't reuse a template user's photo (it points at their storage path), so
// each test account gets a generated neutral avatar (no real person). Encodes
// the display name into a coloured initials image.
const photoForName = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00204a&color=fff&size=256`;

const KINSHASA = {
  lat: -4.4419,
  lng: 15.2663,
  address: 'Boulevard du 30 Juin, Gombe, Kinshasa',
  label: 'Kinshasa',
  city: 'Kinshasa',
  country: 'Democratic Republic of the Congo',
  countryCode: 'CD',
  timeZone: 'Africa/Kinshasa',
  // Synthetic place_id: obviously test data, never collides with a real Google
  // Place or the original template venue. Used on both the seed game and the
  // test accounts' favorite/last-centre fields.
  placeId: 'test_kinshasa_padel_01',
  centreName: 'Kinshasa Padel Test',
  radius: 20000, // metres, matches the app default
};

// ---------------------------------------------------------------------------
// Seed game — cloned in shape from a real recent in-app padel game
// (11Ak8ZabRpYMc6ldRivE, 4PADEL Montreuil) but fully scrubbed of any link back.
// Kept in EUR per Tim (avoids Stripe currency-config risk).
// ---------------------------------------------------------------------------
const SEED_GAME = {
  sport: 'padel',
  paymentType: 'in-app',
  currency: 'EUR',
  price: 5,
  priceUndiscounted: 20,
  maxPlayers: 4,
  playersToFind: 3,
  duration: 120, // minutes
  mood: 'chill',
  type: 'captain',
  visibility: 'public',
  goldExclusive: false,
  // level_deltas controls which player skill levels may join. Keep the real
  // template's spread so the game accepts a wide band of levels.
  levelDeltas: ['three_four', 'five_six', 'seven_eight'],
  description:
    'Kinshasa padel test game — automated UI testing fixture. Not a real game.',
};

// ---------------------------------------------------------------------------
// Skill levels for test joiners — set to comfortably satisfy SEED_GAME's
// level_deltas. The deltas span 3-8, so a mid value of 5 sits squarely inside
// every band and never trips a "level too low/high" gate on the join.
// ---------------------------------------------------------------------------
const TEST_JOINER_LEVELS = {
  padel_skill_level: 5,
  soccer_skill_level: 5,
  soccer_position: 'midfielder',
  declared_level: 5,
};

// Email domain that (a) never receives real mail and (b) is the teardown
// filter for finding every test account.
const TEST_EMAIL_DOMAIN = 'poteau-test.internal';

// Shared password for all test accounts. Poteau's email login is a real
// Firebase email+password sign-in (signInWithEmailAndPassword) that goes
// straight to Home — the 4-digit email_code screen only appears in the SIGNUP
// flow, not login. So pre-provisioned accounts need a real password.
const TEST_PASSWORD = 'PoteauTest!2026';
const isTestEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@' + TEST_EMAIL_DOMAIN);

// ---------------------------------------------------------------------------
// The account roster. `key` becomes the local-part: test_<key>@<domain>.
// `template` selects which real doc shape to clone (resolved in the script).
// ---------------------------------------------------------------------------
const ROSTER = [
  { key: 'marc_organizer',   displayName: 'Marc Test',       first: 'Marc',   last: 'Test', role: 'player',     gold: false, language: 'fr', template: 'player', purpose: 'organizer (owns seed game)' },
  { key: 'sophie_joiner',    displayName: 'Sophie Test',     first: 'Sophie', last: 'Test', role: 'player',     gold: false, language: 'fr', template: 'player', purpose: 'primary sim joiner (FR)' },
  { key: 'liam_joiner_en',   displayName: 'Liam Test',       first: 'Liam',   last: 'Test', role: 'player',     gold: false, language: 'en', template: 'player', purpose: 'EN joiner' },
  { key: 'lucia_joiner_es',  displayName: 'Lucia Test',      first: 'Lucia',  last: 'Test', role: 'player',     gold: false, language: 'es', template: 'player', purpose: 'ES joiner' },
  { key: 'marco_joiner_it',  displayName: 'Marco Test',      first: 'Marco',  last: 'Test', role: 'player',     gold: false, language: 'it', template: 'player', purpose: 'IT joiner' },
  { key: 'gina_gold',        displayName: 'Gina Test',       first: 'Gina',   last: 'Test', role: 'player',     gold: true,  language: 'fr', template: 'gold',   purpose: 'gold joiner' },
  { key: 'todd_ambassador',  displayName: 'Todd Test',       first: 'Todd',   last: 'Test', role: 'ambassador', gold: false, language: 'en', template: 'player', purpose: 'ambassador variant' },
  { key: 'sophie_pro',       displayName: 'Sophie Pro Test', first: 'Sophie', last: 'Test', role: 'pro',        gold: false, language: 'fr', template: 'pro',    purpose: 'pro variant (poteau-max)' },
  { key: 'noah_recent',      displayName: 'Noah Test',       first: 'Noah',   last: 'Test', role: 'player',     gold: false, language: 'fr', template: 'player', purpose: 'fresh/minimal variant' },
  { key: 'spare_joiner',     displayName: 'Spare Test',      first: 'Spare',  last: 'Test', role: 'player',     gold: false, language: 'en', template: 'player', purpose: 'spare second joiner' },
];

// Real doc shapes to clone from (read-only). Chosen during recon 2026-07-08:
// - player: 'Walo', padel-skilled, onboarding complete, no RevenueCat cruft.
// - gold:   a real gold doc (RevenueCat fields present — will be stripped).
// - pro:    a real poteau-max pro (centre_* fields present).
const TEMPLATE_UIDS = {
  player: '0s3VkrOfJDOjp8CIkQ074i1c2I63',
  gold: '00OoZaKuiXcjkW8KUsjnu8bok4c2',
  pro: '1GfAHFfqO6dOj37bPrTRuDS5gnk1',
};

module.exports = {
  KINSHASA,
  SEED_GAME,
  TEST_JOINER_LEVELS,
  TEST_EMAIL_DOMAIN,
  TEST_PASSWORD,
  phoneForIndex,
  photoForName,
  isTestEmail,
  ROSTER,
  TEMPLATE_UIDS,
  emailFor: (key) => `test_${key}@${TEST_EMAIL_DOMAIN}`,
};
