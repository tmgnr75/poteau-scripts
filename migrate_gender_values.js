/**
 * Migrate users.gender legacy values to V5 canonical form.
 *   "man"   -> "male"
 *   "woman" -> "female"
 *
 * Rationale (2026-07-29 audit):
 *   - V5 onboarding writes `Genders.female.name` / `Genders.male.name` -> "female" / "male" (~330 users).
 *   - Pre-V5 onboarding + several CF fallbacks default to "man" / "woman" (~47,000 users).
 *   - We're standardising on "female"/"male" (matches the enum name).
 *   - CFs updated & deployed to accept BOTH before this migration runs,
 *     so the app stays functional during the write pass.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/migrate_gender_values.js   # just report, no writes
 *   node scripts/migrate_gender_values.js             # actually run
 *
 * Progress is logged every 500 writes. Uses batched writes (500/batch,
 * Firestore hard limit). Safe to re-run: no-ops if nothing to migrate.
 */

const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
}

const db = admin.firestore();
const DRY_RUN = process.env.DRY_RUN === '1';
const BATCH_SIZE = 500;

const MAP = { man: 'male', woman: 'female' };

async function countByValue(value) {
  const snap = await db.collection('users').where('gender', '==', value).count().get();
  return snap.data().count;
}

async function sampleByValue(value, n = 3) {
  const snap = await db.collection('users').where('gender', '==', value).limit(n).get();
  return snap.docs.map(d => ({
    uid: d.id,
    display_name: d.get('display_name'),
    gender_before: d.get('gender'),
    gender_after: MAP[d.get('gender')],
  }));
}

async function migrateValue(oldValue, newValue) {
  console.log(`\n=== Migrating gender="${oldValue}" -> "${newValue}" ===`);

  let totalMigrated = 0;
  let lastDoc = null;

  while (true) {
    let q = db.collection('users')
      .where('gender', '==', oldValue)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    if (DRY_RUN) {
      totalMigrated += snap.docs.length;
      console.log(`  [DRY] would update ${snap.docs.length} docs (running total: ${totalMigrated})`);
    } else {
      const batch = db.batch();
      snap.docs.forEach(d => batch.update(d.ref, { gender: newValue }));
      await batch.commit();
      totalMigrated += snap.docs.length;
      console.log(`  updated ${snap.docs.length} docs (running total: ${totalMigrated})`);
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < BATCH_SIZE) break;
  }

  console.log(`  done: ${totalMigrated} docs`);
  return totalMigrated;
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? 'DRY_RUN' : 'LIVE'}`);
  console.log('\n--- Before ---');
  for (const v of ['man', 'woman', 'male', 'female', 'unselected']) {
    const c = await countByValue(v);
    console.log(`  gender="${v}": ${c}`);
  }

  console.log('\n--- Samples of docs to migrate ---');
  for (const v of ['man', 'woman']) {
    const s = await sampleByValue(v, 3);
    console.log(`  ${v}:`);
    s.forEach(row => console.log(`    ${JSON.stringify(row)}`));
  }

  const men = await migrateValue('man', 'male');
  const women = await migrateValue('woman', 'female');

  console.log('\n--- After ---');
  for (const v of ['man', 'woman', 'male', 'female', 'unselected']) {
    const c = await countByValue(v);
    console.log(`  gender="${v}": ${c}`);
  }

  console.log(`\nTotal ${DRY_RUN ? 'would-migrate' : 'migrated'}: ${men + women}`);
  process.exit(0);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
