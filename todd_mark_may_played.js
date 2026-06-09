// Mark ONLY Todd's MAY past-published games as 'played'.
// June published games are intentionally left alone (Todd marks those himself from now on).
// Cutoff: game date strictly before 2026-06-01 (LA time).
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const TODD_UID = 'z7IAPejheYSG2Xf7YXji9rE6xWh2';
const TZ = 'America/Los_Angeles';
const NOW = new Date();
const APPLY = process.argv.includes('--apply');

const laDate = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const laMonth = (d) => laDate(d).slice(0, 7); // YYYY-MM in LA time

async function main() {
  const snap = await db.collection('games')
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
    if (referenceEnd >= NOW) continue;          // not yet past
    if (laMonth(date) !== '2026-05') continue;  // MAY only
    candidates.push({ id: doc.id, date, centre: d.centre || d.address || '', sport: d.sport || '?' });
  }

  console.log(`Found ${candidates.length} past MAY published games for Todd to mark 'played':\n`);
  for (const c of candidates) {
    console.log(`  ${laDate(c.date)}  ${c.sport.padEnd(8)} ${c.centre} — ${c.id}`);
  }
  console.log('');

  if (!APPLY) { console.log('Dry run. Re-run with --apply to write status=played.'); return; }

  const batch = db.batch();
  for (const c of candidates) batch.update(db.collection('games').doc(c.id), { status: 'played' });
  await batch.commit();
  console.log(`✅ Updated ${candidates.length} games to status='played'.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
