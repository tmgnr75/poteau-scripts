#!/usr/bin/env node
// ============================================================
//  POTEAU BILLING — Verification / Reconciliation
//  Checks that all invoices in the Billing Google Sheet
//  have a matching pro_invoices doc in Firestore AND are in the
//  user's pro_invoices array.
//
//  Matching is STRICT: account_reference + amount + invoice_date
//  must all match.
//
//  Usage: node verify.js [--month YYYY-MM]
//  Default: checks ALL months
// ============================================================

const admin = require('firebase-admin');
const { google } = require('googleapis');
const path = require('path');

const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
  });
}
const db = admin.firestore();

const { BILLING_SHEET_ID, CENTRES, FRENCH_MONTHS } = require('./config');

const args = process.argv.slice(2);
const monthIdx = args.indexOf('--month');
const filterMonth = monthIdx !== -1 ? args[monthIdx + 1] : null;

// Parse French month string like "mars 2026" → Date(2026, 3, 1) (1st of NEXT month = invoice date)
function parseInvoiceDate(monthStr) {
  const parts = monthStr.trim().toLowerCase().split(' ');
  if (parts.length !== 2) return null;
  const monthIndex = FRENCH_MONTHS.indexOf(parts[0]);
  if (monthIndex === -1) return null;
  const year = parseInt(parts[1]);
  // Invoice date = 1st of the month AFTER the billed month
  const invoiceMonth = monthIndex + 1; // 0-indexed → 1-indexed
  if (invoiceMonth === 12) {
    return new Date(year + 1, 0, 1);
  }
  return new Date(year, invoiceMonth, 1);
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '..', 'Poteau Billing IAM Admin.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Read all invoices from Billing sheet
  console.log('Reading Billing sheet...\n');
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Invoices!A1:U500',
  });
  const rows = data.data.values || [];
  const invoices = rows.slice(1).filter(r => r[0] && r[0] !== '');

  // Filter by month if requested
  let filtered = invoices;
  if (filterMonth) {
    const [y, m] = filterMonth.split('-').map(Number);
    const expectedStr = `${FRENCH_MONTHS[m - 1]} ${y}`;
    filtered = invoices.filter(r => (r[6] || '').toLowerCase() === expectedStr);
    console.log(`Filtering for ${filterMonth}: ${filtered.length} invoices\n`);
  }

  // 2. Load all pro_invoices from Firestore
  console.log('Loading pro_invoices from Firestore...');
  const proInvoicesSnap = await db.collection('pro_invoices').get();
  const proInvoices = [];
  proInvoicesSnap.forEach(doc => {
    const d = doc.data();
    proInvoices.push({
      docId: doc.id,
      accountRef: d.account_reference?.path || '',
      amount: d.amount,
      status: d.status,
      file: d.file || '',
      invoiceDate: d.invoice_date?.toDate(),
    });
  });
  console.log(`  ${proInvoices.length} pro_invoices docs loaded\n`);

  // 3. Load user pro_invoices arrays (cache to avoid repeated reads)
  const userInvoiceCache = {};
  async function getUserInvoiceRefs(uid) {
    if (userInvoiceCache[uid]) return userInvoiceCache[uid];
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data();
    const refs = (userData.pro_invoices || []).map(ref => {
      if (typeof ref === 'string') return ref;
      if (ref.path) return ref.path;
      return String(ref);
    });
    userInvoiceCache[uid] = refs;
    return refs;
  }

  // 4. For each invoice in the sheet, strict match
  const missing = [];
  const notInArray = [];
  const ok = [];

  for (const row of filtered) {
    const invoiceNum = row[0];
    const type = row[1];
    const centre = row[2];
    const games = row[3];
    const month = row[6]; // e.g. "mars 2026"
    const status = row[7];
    const amountHT = row[11]; // column L

    // Find the centre config
    const centreConfig = CENTRES.find(c => c.billingName === centre);
    if (!centreConfig || !centreConfig.uid) continue;

    const uid = centreConfig.uid;
    const expectedAccountRef = `users/${uid}`;

    // Parse amount from sheet
    const amountNum = parseFloat((amountHT || '0').replace(/[^\d,.-]/g, '').replace(',', '.'));

    // Parse expected invoice date from month string
    const expectedDate = parseInvoiceDate(month);
    if (!expectedDate) {
      console.log(`  ⚠️ Cannot parse month "${month}" for ${invoiceNum}`);
      continue;
    }

    // STRICT match: account_reference + amount (within 1€) + invoice_date (same month)
    const matchingDocs = proInvoices.filter(pi => {
      if (pi.accountRef !== expectedAccountRef) return false;
      if (Math.abs(pi.amount - amountNum) > 1) return false;
      if (!pi.invoiceDate) return false;
      // Invoice date should be within 2 days of expected (to handle timezone offsets)
      const diffMs = Math.abs(pi.invoiceDate.getTime() - expectedDate.getTime());
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 2) return false;
      return true;
    });

    if (matchingDocs.length === 0) {
      missing.push({ invoiceNum, centre, month, amountHT, uid });
      continue;
    }

    const bestMatch = matchingDocs[0];

    // Check if the pro_invoice ref is in the user's pro_invoices array
    const userRefs = await getUserInvoiceRefs(uid);
    const isInArray = userRefs.some(refPath =>
      refPath === `pro_invoices/${bestMatch.docId}` || refPath.includes(bestMatch.docId)
    );

    if (!isInArray) {
      notInArray.push({ invoiceNum, centre, month, docId: bestMatch.docId, uid });
    } else {
      ok.push({ invoiceNum, centre, month });
    }
  }

  // 5. Report
  console.log('='.repeat(70));
  console.log('  RECONCILIATION REPORT');
  console.log('='.repeat(70));

  console.log(`\n  ✅ OK: ${ok.length} invoices fully reconciled`);

  if (missing.length > 0) {
    console.log(`\n  ❌ MISSING from Firestore pro_invoices (${missing.length}):`);
    for (const m of missing) {
      console.log(`     ${m.invoiceNum.padEnd(25)} ${m.centre.padEnd(35)} ${m.month.padEnd(20)} HT: ${m.amountHT}`);
    }
  } else {
    console.log('  ✅ No missing pro_invoices docs');
  }

  if (notInArray.length > 0) {
    console.log(`\n  ⚠️ Doc exists but NOT in user's pro_invoices array (${notInArray.length}):`);
    for (const n of notInArray) {
      console.log(`     ${n.invoiceNum.padEnd(25)} ${n.centre.padEnd(35)} ${n.month.padEnd(20)} doc: ${n.docId} → users/${n.uid}`);
    }
  } else {
    console.log('  ✅ All pro_invoices refs present in user arrays');
  }

  const total = ok.length + missing.length + notInArray.length;
  console.log(`\n  Total checked: ${total} | OK: ${ok.length} | Missing: ${missing.length} | Not in array: ${notInArray.length}`);
  console.log('');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
