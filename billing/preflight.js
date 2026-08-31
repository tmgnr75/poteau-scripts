#!/usr/bin/env node
// ============================================================
//  POTEAU BILLING — Preflight
//  Usage: node preflight.js [--month YYYY-MM]
//
//  Answers, in one command, the questions that have to be settled before
//  a month can be closed. Read-only: it never writes anything.
//
//  Closing August 2026 took a long session mostly because each of these
//  had to be rediscovered by hand.
// ============================================================

const admin = require('firebase-admin');
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const { CENTRES, getPriceHT, TVA_RATE } = require('./config.js');

const args = process.argv.slice(2);
const mi = args.indexOf('--month');
let year, month;
if (mi !== -1 && args[mi + 1]) {
  [year, month] = args[mi + 1].split('-').map(Number);
} else {
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  year = prev.getFullYear(); month = prev.getMonth() + 1;
}

const start = new Date(year, month - 1, 1);
const end   = new Date(year, month, 0, 23, 59, 59);
const fmt = d => d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });

(async () => {
  const now = new Date();
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  BILLING PREFLIGHT — ${String(month).padStart(2,'0')}/${year}`);
  console.log(`  Now (Paris): ${fmt(now)}`);
  console.log(`${'='.repeat(64)}\n`);

  let blocking = 0;

  // ── 1. Is the month finished? ──────────────────────────────
  // gameStatusUpdater only flips a game at kickoff + 2*duration, so a late
  // game on the last day is still in flight well after midnight.
  console.log('1. IS THE MONTH SETTLED?\n');
  const lastDay = new Date(year, month, 0);
  const dayStart = new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate());
  const dayEnd   = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const lastDaySnap = await db.collection('games')
    .where('date', '>=', dayStart).where('date', '<', dayEnd).get();

  const inFlight = [];
  lastDaySnap.forEach(doc => {
    const g = doc.data();
    if (g.status !== 'published') return;
    const d = Number(g.duration);
    const k = g.date.toDate();
    const sweepAt = Number.isFinite(d) && d > 0
      ? new Date(k.getTime() + 2 * d * 60000)
      : new Date(k.getTime() + 3600000);
    if (sweepAt > now) inFlight.push({ id: doc.id, k, sweepAt, att: (g.attendees || []).length, max: g.max_players, centre: g.centre });
  });

  if (inFlight.length === 0) {
    console.log('   OK — every game on the last day has passed its sweep window.\n');
  } else {
    blocking++;
    inFlight.sort((a, b) => a.sweepAt - b.sweepAt);
    const last = inFlight[inFlight.length - 1];
    console.log(`   WAIT — ${inFlight.length} game(s) can still flip to played.`);
    console.log(`   Last one settles at ${fmt(last.sweepAt)}.\n`);
    inFlight.forEach(r => {
      const willCount = r.att >= 2 && r.att >= r.max;
      console.log(`     ${fmt(r.k)} | ${r.att}/${r.max} | settles ${fmt(r.sweepAt)} | ${willCount ? 'WILL count' : 'will not count (not full)'} | ${r.centre}`);
    });
    console.log('');
  }

  // ── 2. Games stuck outside the sweep's reach ───────────────
  // The lookback window must outlast the 2*duration guard, or a long booking
  // can never be selected. Fixed to 36h on 2026-09-01; this catches a regression.
  console.log('2. GAMES THE SWEEP CANNOT REACH\n');
  const LOOKBACK_H = 36;
  const pubSnap = await db.collection('games').where('status', '==', 'published')
    .where('date', '>=', admin.firestore.Timestamp.fromDate(start))
    .where('date', '<=', admin.firestore.Timestamp.fromDate(end)).get();
  const unreachable = [];
  pubSnap.forEach(doc => {
    const g = doc.data();
    const d = Number(g.duration);
    if (!Number.isFinite(d) || 2 * d / 60 < LOOKBACK_H) return;
    const att = (g.attendees || []).length;
    if (att >= 2 && att >= g.max_players) unreachable.push({ id: doc.id, d, att, max: g.max_players, centre: g.centre });
  });
  if (unreachable.length === 0) {
    console.log(`   OK — no roster-full game exceeds the ${LOOKBACK_H}h lookback.\n`);
  } else {
    blocking++;
    console.log(`   ${unreachable.length} game(s) are eligible but unreachable — flip them by hand:\n`);
    unreachable.forEach(r => console.log(`     ${r.id} | ${r.d}min (${(r.d/60).toFixed(1)}h) | ${r.att}/${r.max} | ${r.centre}`));
    console.log('');
  }

  // ── 3. The invoice preview ─────────────────────────────────
  console.log('3. WHAT WILL BE BILLED\n');
  console.log('   centre                     | pro | capt |     HT |      TTC');
  console.log('   ' + '-'.repeat(62));
  let totalHT = 0, billable = 0;
  for (const c of CENTRES) {
    if (!c.uid) continue;
    const snap = await db.collection('games')
      .where('organizer', '==', c.uid).where('status', '==', 'played')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(start))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(end)).get();
    let pro = 0, capt = 0;
    snap.forEach(d => { const t = d.data().type; if (t === 'pro') pro++; else capt++; });
    if (pro === 0 && capt === 0) continue;
    const ht = c.skip || !c.billingName ? 0 : getPriceHT(pro);
    const note = c.skip ? ' (annual, skipped)' : !c.billingName ? ' (not billed)' : '';
    if (ht > 0) { totalHT += ht; billable++; }
    console.log(`   ${c.reportingName.padEnd(26)} | ${String(pro).padStart(3)} | ${String(capt).padStart(4)} | ${String(ht).padStart(6)} | ${(ht * (1 + TVA_RATE)).toFixed(2).padStart(8)}${note}`);
  }
  console.log('   ' + '-'.repeat(62));
  console.log(`   ${billable} invoices | ${totalHT} EUR HT | ${(totalHT * (1 + TVA_RATE)).toFixed(2)} EUR TTC\n`);

  // ── 4. Has this month already been charged? ────────────────
  console.log('4. ALREADY CHARGED?\n');
  const invDate = new Date(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1);
  const existing = await db.collection('pro_invoices')
    .where('invoice_date', '==', admin.firestore.Timestamp.fromDate(invDate)).get();
  if (existing.empty) {
    console.log('   No pro_invoices exist for this month yet — clean slate.\n');
  } else {
    console.log(`   ${existing.size} pro_invoices document(s) already exist for this month.`);
    const names = {};
    existing.forEach(d => { const n = d.data().invoice_name || '(no invoice_name)'; names[n] = (names[n] || 0) + 1; });
    // Documents written before 2026-09-01 have no invoice_name and a random
    // id, so they all collapse into one bucket here. That is a legacy shape,
    // not a duplicate -- only flag repeats of a REAL invoice number.
    const legacy = names['(no invoice_name)'] || 0;
    delete names['(no invoice_name)'];
    const dupes = Object.entries(names).filter(([, n]) => n > 1);
    if (dupes.length) {
      blocking++;
      console.log(`   DUPLICATES: ${JSON.stringify(dupes)}`);
      console.log('   Step 4 is idempotent now, so these predate the fix. Clean before re-running.\n');
    } else if (legacy > 0) {
      console.log(`   ${legacy} document(s) predate the invoice_name/doc-id fix (random ids).`);
      console.log('   Harmless, but a re-run of step 4 would ADD to them rather than');
      console.log('   replace them. Delete them first if you re-run this month.\n');
    } else {
      console.log('   No duplicates. A re-run will update these in place.\n');
    }
  }

  console.log('='.repeat(64));
  if (blocking === 0) {
    console.log('  READY. Next:');
    console.log(`    node run.js --no-charge --month ${year}-${String(month).padStart(2,'0')}     # sheets + PDFs`);
    console.log(`    node run.js --charge-only --month ${year}-${String(month).padStart(2,'0')}   # the debits`);
  } else {
    console.log(`  ${blocking} thing(s) to resolve first — see above.`);
  }
  console.log('='.repeat(64) + '\n');
  process.exit(0);
})();
