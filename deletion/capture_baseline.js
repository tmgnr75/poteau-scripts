/**
 * Capture the pre-send baseline for the retention / win-back campaign.
 *
 * WHY THIS MUST RUN BEFORE RETENTION_APPLY=true
 *
 * The impact analysis is a before-and-after, and the "before" cannot be
 * reconstructed once the first email lands: `last_activity_date` starts moving
 * as people return, `retention_warned_at` gets stamped, and accounts begin
 * disappearing. This writes one immutable snapshot of who was in the cohort and
 * what state they were in at that moment.
 *
 * Stored in `campaign_baselines/{id}` with a per-uid subcollection, so the
 * impact session can diff against it without needing any of this code.
 *
 * Idempotent per id: re-running overwrites the same snapshot.
 *
 * USAGE
 *   node capture_baseline.js                 # dry run
 *   node capture_baseline.js --apply
 */
const path = require("path");
const admin = require("firebase-admin");
const sa = require(path.join(__dirname, "..", "krank-club-firebase-adminsdk-bl4zy-d8facdf022.json"));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: "krank-club" });
const db = admin.firestore();

const APPLY = process.argv.includes("--apply");
const DAY = 86400000;
const SENTINEL = new Date("2000-01-01").getTime();
const DELETE_AFTER = 3 * 365, WARN_AFTER = 3 * 365 - 30;
const BASELINE_ID = "retention_2026_10";

const ms = (t) => (t && typeof t.toDate === "function" ? t.toDate().getTime() : null);

(async () => {
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN ===");
  const now = Date.now();
  const snap = await db.collection("users")
    .select("last_activity_date", "created_time", "type", "email", "language",
            "games", "played_games", "last_address", "auth_email",
            "retention_warned_at", "is_test_account", "is_tombstone")
    .get();

  const cohort = [];
  let exempt = 0, noSignal = 0;

  snap.forEach((d) => {
    const t = d.get("type");
    if (t === "pro" || t === "super_pro" || d.get("is_tombstone") === true || d.get("is_test_account") === true) { exempt++; return; }
    const la = ms(d.get("last_activity_date"));
    const eff = (la !== null && la > SENTINEL) ? la : ms(d.get("created_time"));
    if (eff === null) { noSignal++; return; }
    const age = now - eff;
    if (age < WARN_AFTER * DAY) return;

    const g = d.get("games"), pg = d.get("played_games");
    cohort.push({
      uid: d.id,
      effectiveActivity: new Date(eff).toISOString(),
      pastCutoff: age >= DELETE_AFTER * DAY,
      hasEmail: !!d.get("email"),
      optedOut: d.get("auth_email") === false,
      language: d.get("language") || "fr",
      hasCity: !!d.get("last_address"),
      gamesCount: Array.isArray(g) ? g.length : 0,
      playedCount: Array.isArray(pg) ? pg.length : 0,
      everPlayed: Array.isArray(g) && g.length > 0,
      alreadyWarned: !!d.get("retention_warned_at"),
    });
  });

  const played = cohort.filter((c) => c.everPlayed).length;
  const summary = {
    id: BASELINE_ID,
    capturedAt: new Date().toISOString(),
    totalUsers: snap.size,
    exempt, noSignal,
    cohortSize: cohort.length,
    pastCutoff: cohort.filter((c) => c.pastCutoff).length,
    inWarningWindow: cohort.filter((c) => !c.pastCutoff).length,
    withEmail: cohort.filter((c) => c.hasEmail).length,
    optedOut: cohort.filter((c) => c.optedOut).length,
    withCity: cohort.filter((c) => c.hasCity).length,
    everPlayed: played,
    neverPlayed: cohort.length - played,
    byLanguage: cohort.reduce((a, c) => { a[c.language] = (a[c.language] || 0) + 1; return a; }, {}),
  };

  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    console.log(`\nRun with --apply to write campaign_baselines/${BASELINE_ID} (${cohort.length} member docs).`);
    process.exit(0);
  }

  await db.collection("campaign_baselines").doc(BASELINE_ID).set(summary);
  const col = db.collection("campaign_baselines").doc(BASELINE_ID).collection("members");
  let n = 0;
  for (let i = 0; i < cohort.length; i += 400) {
    const batch = db.batch();
    cohort.slice(i, i + 400).forEach((c) => batch.set(col.doc(c.uid), c));
    await batch.commit();
    n += Math.min(400, cohort.length - i);
    if (n % 2000 === 0 || n === cohort.length) console.log(`  ${n}/${cohort.length}`);
  }
  console.log(`\nWrote campaign_baselines/${BASELINE_ID} with ${n} members.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
