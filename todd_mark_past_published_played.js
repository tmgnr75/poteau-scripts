const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';

// "Past" cutoff: now. End_time (if present) or date must be strictly before this.
const NOW = new Date();

const APPLY = process.argv.includes('--apply');

const laDate = (d) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);

const laTime = (d) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);

async function main() {
  const snap = await db
    .collection('games')
    .where('organizer', '==', TODD_UID)
    .where('status', '==', 'published')
    .orderBy('date', 'asc')
    .get();

  const candidates = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    const date = d.date?.toDate ? d.date.toDate() : new Date(d.date);
    const endTime = d.end_time?.toDate ? d.end_time.toDate() : (d.end_time ? new Date(d.end_time) : null);
    const referenceEnd = endTime || date;
    if (referenceEnd >= NOW) continue; // not yet past
    candidates.push({ id: doc.id, date, endTime, centre: d.centre || '', sport: d.sport || '?' });
  }

  console.log(`Found ${candidates.length} past published games for Todd that should be 'played'.\n`);
  if (candidates.length === 0) return;

  console.log(
    'Date (LA)'.padEnd(13) +
      'Start'.padEnd(7) +
      'End'.padEnd(7) +
      'Sport'.padEnd(10) +
      'Centre / Game ID',
  );
  console.log('-'.repeat(100));
  for (const c of candidates) {
    console.log(
      laDate(c.date).padEnd(13) +
        laTime(c.date).padEnd(7) +
        (c.endTime ? laTime(c.endTime) : '—').padEnd(7) +
        c.sport.padEnd(10) +
        `${c.centre} — ${c.id}`,
    );
  }
  console.log('');

  if (!APPLY) {
    console.log('Dry run. Re-run with --apply to write status=played to Firestore.');
    return;
  }

  console.log('Applying updates...');
  const batch = db.batch();
  for (const c of candidates) {
    batch.update(db.collection('games').doc(c.id), { status: 'played' });
  }
  await batch.commit();
  console.log(`✅ Updated ${candidates.length} games to status='played'.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
