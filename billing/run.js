#!/usr/bin/env node
// ============================================================
//  POTEAU BILLING — Monthly Billing Orchestrator
//  Usage: node run.js [--dry-run] [--month YYYY-MM] [--invoices] [--no-charge]
//
//  By default, bills for the PREVIOUS month.
//  --dry-run:  preview everything without writing anything
//  --month YYYY-MM: override the billing month
//  --invoices: ONLY do step 4 (PDFs + Firebase + Drive + Firestore docs)
//              based on existing Billing sheet rows. Skips Firestore query,
//              Reporting update, Sheet write, and GoCardless payments.
//  --no-charge: run steps 1-4 (sheets + PDFs) but STOP before step 5, so no
//              GoCardless payment is created. The intended two-pass close:
//              fill the reporting, eyeball the numbers, then re-run step 5
//              on its own. Charging is the one irreversible step here.
//  --charge-only: ONLY do step 5, from the invoice rows already in the Billing
//              sheet. The mirror of --no-charge and the second half of the
//              two-pass close. Does NOT touch Firestore, Drive or the sheets,
//              so it cannot duplicate pro_invoices documents the way a full
//              re-run does (each generatePDFs call .add()s a fresh doc).
//              Mandates are resolved from the sheet's own Mandate column,
//              which holds the GoCardless customer ID.
// ============================================================

const admin = require('firebase-admin');
const { google } = require('googleapis');
const GoCardlessClient = require('gocardless-nodejs').default;
const constants = require('gocardless-nodejs/constants');
const path = require('path');

const {
  REPORTING_SHEET_ID, BILLING_SHEET_ID, GOCARDLESS_ACCESS_TOKEN,
  getPriceHT, TVA_RATE, FRENCH_MONTHS, FRENCH_MONTH_CODES, CENTRES,
} = require('./config');

const DRIVE_ROOT_FOLDER_ID = '1w05RB53a3q0GrqGO6rX5d3IJbgcFOTJz';

// ── Parse CLI args ──────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const INVOICES_ONLY = args.includes('--invoices');
const NO_CHARGE = args.includes('--no-charge');
const CHARGE_ONLY = args.includes('--charge-only');

if (NO_CHARGE && CHARGE_ONLY) {
  console.error('--no-charge and --charge-only are mutually exclusive.');
  process.exit(1);
}
const monthIdx = args.indexOf('--month');
let billingYear, billingMonth;

if (monthIdx !== -1 && args[monthIdx + 1]) {
  const [y, m] = args[monthIdx + 1].split('-').map(Number);
  billingYear = y;
  billingMonth = m; // 1-indexed
} else {
  // Default: previous month
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  billingYear = prev.getFullYear();
  billingMonth = prev.getMonth() + 1;
}

const billingMonthName = FRENCH_MONTHS[billingMonth - 1];
const billingMonthCode = FRENCH_MONTH_CODES[billingMonth - 1];
const invoiceYear = billingMonth === 12 ? billingYear + 1 : billingYear;
const invoiceMonth = billingMonth === 12 ? 1 : billingMonth + 1;
const invoiceDateStr = `1 ${FRENCH_MONTHS[invoiceMonth - 1]}`;

console.log(`\n${'='.repeat(60)}`);
console.log(`  POTEAU BILLING — ${billingMonthName} ${billingYear}`);
console.log(`  Invoice date: ${invoiceDateStr} ${invoiceYear}`);
console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚡ LIVE'}${NO_CHARGE ? '  (--no-charge: steps 1-4 only, no debits)' : ''}${CHARGE_ONLY ? '  (--charge-only: step 5 only)' : ''}`);
console.log(`${'='.repeat(60)}\n`);

// ── Init services ───────────────────────────────────────────
const serviceAccount = require('../krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
  storageBucket: 'krank-club.appspot.com',
});
const db = admin.firestore();

const sheetsAuth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '..', 'Poteau Billing IAM Admin.json'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

const gcClient = new GoCardlessClient(
  GOCARDLESS_ACCESS_TOKEN,
  constants.Environments.Live,
);

// ── Helpers ─────────────────────────────────────────────────
function formatEur(amount) {
  return amount.toLocaleString('fr-FR') + ' €';
}

// Google Sheets serial date (days since 1899-12-30)
function toSerialDate(year, month, day) {
  const epoch = new Date(1899, 11, 30);
  const target = new Date(year, month - 1, day);
  return Math.round((target - epoch) / (24 * 60 * 60 * 1000));
}

// Column number to letter (1=A, 2=B, ..., 26=Z, 27=AA)
function colLetter(n) {
  let s = '';
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// ── STEP 1: Query Firestore for games ───────────────────────
async function queryGames() {
  console.log('📊 Step 1: Querying Firestore for played games...\n');

  const startDate = new Date(billingYear, billingMonth - 1, 1);
  const endDate = new Date(billingYear, billingMonth, 0, 23, 59, 59);

  const results = [];

  for (const centre of CENTRES) {
    if (!centre.uid || centre.skip) {
      results.push({ centre, gamesPlayed: 0, revenue: 0, onSiteGames: 0, inAppGames: 0, inAppRevenue: 0 });
      continue;
    }

    const snapshot = await db.collection('games')
      .where('organizer', '==', centre.uid)
      .where('status', '==', 'played')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(startDate))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(endDate))
      .get();

    let totalGames = 0;
    let totalRevenue = 0;
    let onSiteGames = 0;
    let inAppGames = 0;
    let inAppRevenue = 0;

    snapshot.forEach(doc => {
      const game = doc.data();

      // REVENUE IS max_players * price, NOT attendees * price.
      //
      // A centre books a pitch, not a seat. Once a game is played the slot is
      // consumed and the centre bills it whole, so the revenue it generated is
      // the full field price -- whether ten players showed up or eight.
      // Counting the roster instead understates every game that ran short, and
      // understates it silently (never high, always low).
      //
      // This used to read `game.attendees.length`, which disagreed with the
      // pro dashboard (`updateProMetrics`, cloud-functions index.js) that has
      // always used max_players. Found 2026-09-01 while closing August:
      // Stadium Thiais differed by 162 EUR, IMPULSTAR PARK by 126 EUR over the
      // month. The dashboard was right; this was wrong. Tim, 2026-09-01:
      // "Centers reason with fields booked (so full price)."
      //
      // Reporting only -- invoices are tiered on game COUNT, so no invoice
      // total changes as a result of this fix.
      const price = game.price || 0;
      const gameRevenue = price * (game.max_players || 0);
      const paymentType = (game.payment_type || 'on-site').toLowerCase().replace(/[_\s]+/g, '-');

      totalGames++;
      totalRevenue += gameRevenue;

      if (paymentType === 'in-app') {
        inAppGames++;
        inAppRevenue += gameRevenue;
      } else {
        onSiteGames++;
      }
    });

    results.push({
      centre,
      gamesPlayed: totalGames,
      revenue: totalRevenue,
      onSiteGames,
      inAppGames,
      inAppRevenue,
    });

    if (totalGames > 0) {
      console.log(`  ${centre.reportingName.padEnd(30)} | ${String(totalGames).padStart(4)} games | ${formatEur(totalRevenue).padStart(12)} | on-site: ${onSiteGames} | in-app: ${inAppGames} (${formatEur(inAppRevenue)})`);
    }
  }

  console.log('');
  return results;
}

// ── STEP 2: Update Reporting Google Sheet ───────────────────
async function updateReporting(sheets, results) {
  console.log('📝 Step 2: Updating Reporting Google Sheet...\n');

  // Find the column for this month. Headers are in row 1.
  // We need to find which column corresponds to the billing month.
  // Columns go from B onwards. We'll read row 1 to find the header.
  const headerData = await sheets.spreadsheets.values.get({
    spreadsheetId: REPORTING_SHEET_ID,
    range: 'PLAYERS!A1:AZ1',
  });
  const headers = headerData.data.values ? headerData.data.values[0] : [];

  // Find or create column for this month
  // Month header format: "mars 2026" in French
  const targetHeader = `${billingMonthName} ${billingYear}`;
  // Also try abbreviated format used in existing headers: "mars 2026" vs "mars 2025"
  // Headers look like: "sept. 2023", "oct. 2023", "mars 2024" etc.
  // They use abbreviated months with dots: sept., oct., nov., déc., janv., févr.
  const MONTH_ABBREVS = [
    'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'
  ];
  const targetAbbrev = `${MONTH_ABBREVS[billingMonth - 1]} ${billingYear}`;

  let colIndex = -1;
  for (let i = 1; i < headers.length; i++) {
    const h = (headers[i] || '').trim().toLowerCase();
    if (h === targetHeader.toLowerCase() || h === targetAbbrev.toLowerCase()) {
      colIndex = i + 1; // 1-indexed column number
      break;
    }
  }

  if (colIndex === -1) {
    // Need to add a new column
    colIndex = headers.length + 1;
    console.log(`  Adding new column ${colLetter(colIndex)} with header "${targetAbbrev}"`);

    if (!DRY_RUN) {
      // Write header to both PLAYERS and Indies tab, row 1
      const col = colLetter(colIndex);
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: REPORTING_SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: [
            { range: `PLAYERS!${col}1`, values: [[targetAbbrev]] },
            { range: `Indies!${col}1`, values: [[targetAbbrev]] },
          ],
        },
      });
    }
  } else {
    console.log(`  Found existing column ${colLetter(colIndex)} for "${targetAbbrev}"`);
  }

  const col = colLetter(colIndex);

  // Prepare batch updates for revenue and matches
  const updates = [];

  for (const { centre, gamesPlayed, revenue } of results) {
    if (centre.skip || !centre.uid) continue;
    const tab = centre.reportingTab;

    // Revenue cell
    updates.push({
      range: `'${tab}'!${col}${centre.revenueRow}`,
      values: [[revenue > 0 ? `${formatEur(revenue)}` : '0 €']],
    });

    // Matches cell
    updates.push({
      range: `'${tab}'!${col}${centre.matchesRow}`,
      values: [[gamesPlayed]],
    });
  }

  if (DRY_RUN) {
    console.log(`  Would write ${updates.length} cells to Reporting sheet`);
    for (const u of updates.slice(0, 6)) {
      console.log(`    ${u.range} = ${JSON.stringify(u.values[0][0])}`);
    }
    if (updates.length > 6) console.log(`    ... and ${updates.length - 6} more`);
  } else {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: REPORTING_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates,
      },
    });
    console.log(`  ✅ Wrote ${updates.length} cells to Reporting sheet`);
  }

  console.log('');
}

// ── STEP 3: Build invoice list and update Billing sheet ─────
async function updateBilling(sheets, results) {
  console.log('💰 Step 3: Calculating billing and updating Billing sheet...\n');

  // Build mandate mapping: customerID -> mandateID
  const mandateMap = {};
  const mandates = await gcClient.mandates.list({ status: 'active', limit: 100 });
  for (const m of mandates.mandates) {
    mandateMap[m.links.customer] = m.id;
  }

  // Find the first empty row in Invoices tab
  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Invoices!A1:A500',
  });
  const firstEmptyRow = (existingData.data.values ? existingData.data.values.length : 0) + 1;

  console.log(`  First empty row in Invoices: ${firstEmptyRow}`);

  // Google Sheets serial date for invoice date (1st of next month)
  const serialDate = toSerialDate(invoiceYear, invoiceMonth, 1);

  const invoiceRows = [];
  const goCardlessPayments = [];

  for (const result of results) {
    const { centre, gamesPlayed, revenue, onSiteGames, inAppGames, inAppRevenue } = result;
    if (centre.skip || !centre.billingName) continue;

    // Pricing is based on TOTAL games played (on-site + in-app combined)
    // On-site invoice: if total games >= 6
    if (gamesPlayed >= 6) {
      const priceHT = getPriceHT(gamesPlayed);
      const priceTTC = Math.round(priceHT * (1 + TVA_RATE) * 100) / 100;

      invoiceRows.push({
        type: 'on site',
        centre: centre.billingName,
        games: gamesPlayed, // total games (on-site + in-app)
        revenue: '', // empty for on-site invoices (pricing is tier-based)
        date: serialDate,
        month: `${billingMonthName} ${billingYear}`,
        status: 'pending',
        priceHT,
        priceTTC,
        customerID: centre.customerID,
        mandateID: centre.customerID ? mandateMap[centre.customerID] : null,
      });
    }

    // In-app invoice (separate): if there are in-app games with revenue
    if (inAppGames > 0 && inAppRevenue > 0) {
      invoiceRows.push({
        type: 'in-app',
        centre: centre.billingName,
        games: inAppGames,
        revenue: formatEur(inAppRevenue),
        date: serialDate,
        month: `${billingMonthName} ${billingYear}`,
        status: 'paid', // in-app invoices are pre-paid
        priceHT: null,
        priceTTC: null,
        customerID: null,
        mandateID: null,
      });
    }
  }

  // Print summary
  console.log(`\n  Invoices to create: ${invoiceRows.length}`);
  console.log(`  ${'─'.repeat(80)}`);
  console.log(`  ${'Type'.padEnd(10)} ${'Centre'.padEnd(35)} ${'Games'.padStart(6)} ${'HT'.padStart(10)} ${'TTC'.padStart(10)}`);
  console.log(`  ${'─'.repeat(80)}`);

  for (const inv of invoiceRows) {
    const ht = inv.priceHT !== null ? formatEur(inv.priceHT) : inv.revenue;
    const ttc = inv.priceTTC !== null ? formatEur(inv.priceTTC) : '-';
    console.log(`  ${inv.type.padEnd(10)} ${inv.centre.padEnd(35)} ${String(inv.games).padStart(6)} ${ht.padStart(10)} ${ttc.padStart(10)}`);
  }
  console.log(`  ${'─'.repeat(80)}`);

  // Write to Invoices sheet
  // Only write columns B-H (the non-formula columns)
  const sheetRows = invoiceRows.map(inv => [
    inv.type,    // B
    inv.centre,  // C
    inv.games,   // D
    inv.revenue, // E
    inv.date,    // F (serial date)
    inv.month,   // G
    inv.status,  // H
  ]);

  // Check if invoices for this month already exist (avoid duplicates on re-run)
  const existingInvoices = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Invoices!A1:H500',
  });
  const existingRows = existingInvoices.data.values || [];
  const targetMonthStr = `${billingMonthName} ${billingYear}`;
  const alreadyExists = existingRows.some(row => row[6] === targetMonthStr && row[0]);

  if (alreadyExists) {
    console.log(`\n  Invoices for "${targetMonthStr}" already exist — skipping sheet write`);
    // Read back existing invoice numbers for this month
    for (const inv of invoiceRows) {
      const match = existingRows.find(row =>
        row[6] === targetMonthStr && row[2] === inv.centre && row[1] === inv.type
      );
      if (match) inv.invoiceNumber = match[0];
    }
  } else if (DRY_RUN) {
    console.log(`\n  Would write ${sheetRows.length} rows starting at row ${firstEmptyRow}`);
  } else {
    if (sheetRows.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: BILLING_SHEET_ID,
        range: `Invoices!B${firstEmptyRow}:H${firstEmptyRow + sheetRows.length - 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: sheetRows },
      });
      console.log(`\n  ✅ Wrote ${sheetRows.length} invoice rows to Billing sheet`);
    }

    // Wait for formulas to recalculate, then read back the generated invoice numbers
    await new Promise(r => setTimeout(r, 3000));

    const invoiceNumbers = await sheets.spreadsheets.values.get({
      spreadsheetId: BILLING_SHEET_ID,
      range: `Invoices!A${firstEmptyRow}:A${firstEmptyRow + sheetRows.length - 1}`,
    });

    if (invoiceNumbers.data.values) {
      for (let i = 0; i < invoiceRows.length; i++) {
        invoiceRows[i].invoiceNumber = invoiceNumbers.data.values[i]?.[0] || '';
      }
    }
  }

  console.log('');
  return { invoiceRows, mandateMap, firstEmptyRow };
}

// ── STEP 4: Generate PDFs via Google Sheets export ──────────
async function generatePDFs(sheets, invoiceRows) {
  console.log('📄 Step 4: Generating invoice PDFs → Firebase + Google Drive...\n');

  // Get OAuth token for PDF export
  const authClient = await sheetsAuth.getClient();
  const tokenRes = await authClient.getAccessToken();
  const token = tokenRes.token;

  // Get sheet GIDs for On-Site FR and In-App FR tabs
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: BILLING_SHEET_ID });
  const tabGids = {};
  for (const s of sheetMeta.data.sheets) {
    tabGids[s.properties.title] = s.properties.sheetId;
  }

  const bucket = admin.storage().bucket();
  const invoiceDocs = [];

  // Google Drive: find or create subfolder for billing month (YYYY-MM)
  const drive = google.drive({ version: 'v3', auth: await sheetsAuth.getClient() });
  const billedYM = `${billingYear}-${String(billingMonth).padStart(2, '0')}`;

  let driveFolderId;
  const folderSearch = await drive.files.list({
    q: `'${DRIVE_ROOT_FOLDER_ID}' in parents and name='${billedYM}' and mimeType='application/vnd.google-apps.folder'`,
    fields: 'files(id)',
  });
  if (folderSearch.data.files.length > 0) {
    driveFolderId = folderSearch.data.files[0].id;
    console.log(`  Drive folder "${billedYM}" found: ${driveFolderId}`);
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: billedYM,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [DRIVE_ROOT_FOLDER_ID],
      },
      fields: 'id',
    });
    driveFolderId = created.data.id;
    console.log(`  Drive folder "${billedYM}" created: ${driveFolderId}`);
  }
  console.log('');

  for (const inv of invoiceRows) {
    if (!inv.invoiceNumber) {
      console.log(`  ⚠️ Skipping ${inv.centre} — no invoice number generated`);
      continue;
    }

    const tabName = inv.type === 'in-app' ? 'In-App FR' : 'On-Site FR';
    const gid = tabGids[tabName];

    console.log(`  Generating ${inv.invoiceNumber} (${tabName})...`);

    // Set F4 to the invoice number to trigger template formulas
    if (!DRY_RUN) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: BILLING_SHEET_ID,
        range: `'${tabName}'!F4`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[inv.invoiceNumber]] },
      });

      // Wait for formulas
      await new Promise(r => setTimeout(r, 2000));

      // Export as PDF
      const pdfUrl = `https://docs.google.com/spreadsheets/d/${BILLING_SHEET_ID}/export`
        + `?format=pdf&gid=${gid}&size=A4&portrait=true&fitw=true`
        + `&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false`;

      let pdfBlob;
      for (let attempt = 0; attempt < 5; attempt++) {
        const res = await fetch(pdfUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          pdfBlob = Buffer.from(await res.arrayBuffer());
          if (pdfBlob.length > 1000) break;
        }

        if (res.status === 429) {
          const wait = 3000 * Math.pow(2, attempt);
          console.log(`    429 — waiting ${wait / 1000}s...`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        console.log(`    HTTP ${res.status} — retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      }

      if (!pdfBlob || pdfBlob.length < 1000) {
        console.log(`  ❌ Failed to generate PDF for ${inv.invoiceNumber}`);
        continue;
      }

      // Upload to Firebase Storage (same path pattern as existing invoices)
      const ADMIN_UID = '1RJFDFRGwfeFnRE5RitMZDBW0Ao1';
      const timestamp = Date.now() + '000';
      const storagePath = `users/${ADMIN_UID}/uploads/${timestamp}.pdf`;
      const file = bucket.file(storagePath);

      // Upload with a download token for Firebase-style URL
      const downloadToken = require('crypto').randomUUID();
      await file.save(pdfBlob, {
        contentType: 'application/pdf',
        metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } },
      });

      const fileUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;

      // Upload to Google Drive
      const { Readable } = require('stream');
      // Check if file already exists in Drive folder
      const existingFiles = await drive.files.list({
        q: `'${driveFolderId}' in parents and name='${inv.invoiceNumber}.pdf'`,
        fields: 'files(id)',
        supportsAllDrives: true,
      });
      if (existingFiles.data.files.length > 0) {
        console.log(`    📁 Already on Drive: ${billedYM}/${inv.invoiceNumber}.pdf`);
      } else {
        try {
          await drive.files.create({
            requestBody: {
              name: `${inv.invoiceNumber}.pdf`,
              parents: [driveFolderId],
            },
            media: {
              mimeType: 'application/pdf',
              body: Readable.from(pdfBlob),
            },
            supportsAllDrives: true,
          });
          console.log(`    📁 Uploaded to Drive: ${billedYM}/${inv.invoiceNumber}.pdf`);
        } catch (driveErr) {
          console.log(`    ⚠️ Drive upload failed (${driveErr.message}) — continuing without Drive`);
        }
      }

      // Create pro_invoices document in Firestore
      const centreUid = findCentreUid(inv.centre);
      const accountRef = db.doc(`users/${centreUid}`);
      // For on-site: priceHT is already HT. For in-app: revenue is TTC, divide by 1.2
      const amountHT = inv.priceHT !== null
        ? inv.priceHT
        : Math.round(parseFloat((inv.revenue || '0').replace(/[^\d,]/g, '').replace(',', '.')) / 1.2 * 100) / 100;

      const invoiceDoc = {
        account_reference: accountRef,
        amount: amountHT,
        file: fileUrl,
        invoice_date: admin.firestore.Timestamp.fromDate(new Date(invoiceYear, invoiceMonth - 1, 1)),
        status: inv.status,
      };

      const docRef = await db.collection('pro_invoices').add(invoiceDoc);

      // Add reference to the centre's user document pro_invoices array
      await db.collection('users').doc(centreUid).update({
        pro_invoices: admin.firestore.FieldValue.arrayUnion(docRef),
      });

      invoiceDocs.push({ ...invoiceDoc, docId: docRef.id });

      console.log(`    ✅ ${inv.invoiceNumber} → uploaded, Firestore doc ${docRef.id} created, added to users/${centreUid}.pro_invoices`);

      // Rate limit between PDFs
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n  Generated ${invoiceDocs.length} invoice PDFs\n`);
  return invoiceDocs;
}

function findCentreUid(billingName) {
  const centre = CENTRES.find(c => c.billingName === billingName);
  return centre?.uid;
}

// ── STEP 5: Create GoCardless payments ──────────────────────
async function createPayments(invoiceRows, mandateMap) {
  console.log('💳 Step 5: Creating GoCardless payments (on-site only)...\n');

  const yearStr = String(billingYear).slice(-2);
  const reference = `POTEAU-MAX-${billingMonthCode}${yearStr}`;

  const onSiteInvoices = invoiceRows.filter(
    inv => inv.type === 'on site' && inv.mandateID && inv.priceTTC > 0
  );

  console.log(`  Payment reference: ${reference}`);
  console.log(`  On-site invoices to charge: ${onSiteInvoices.length}\n`);

  for (const inv of onSiteInvoices) {
    const amountCents = Math.round(inv.priceTTC * 100);
    const description = `${billingMonthName.charAt(0).toUpperCase() + billingMonthName.slice(1)} ${billingYear} - ${inv.games} matchs joués`;

    console.log(`  ${inv.centre.padEnd(35)} ${formatEur(inv.priceTTC).padStart(10)} → mandate ${inv.mandateID}`);

    if (!DRY_RUN) {
      try {
        const payment = await gcClient.payments.create({
          amount: amountCents,
          currency: 'EUR',
          description,
          reference,
          links: { mandate: inv.mandateID },
          metadata: {},
        });
        console.log(`    ✅ Payment ${payment.id} created (charge date: ${payment.charge_date})`);
      } catch (err) {
        console.log(`    ❌ Error: ${err.message}`);
      }
    }
  }

  console.log('');
}

// ── Load invoice rows from existing Billing sheet for --invoices mode ──
async function loadInvoicesFromSheet(sheets) {
  console.log('📑 Loading existing invoices from Billing sheet for ' + billingMonthName + ' ' + billingYear + '...\n');

  const data = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Invoices!A1:U500',
  });
  const rows = data.data.values || [];
  const targetMonthStr = `${billingMonthName} ${billingYear}`;

  const invoiceRows = [];
  for (const row of rows.slice(1)) {
    const invoiceNum = row[0];
    const type = row[1];
    const centre = row[2];
    const games = row[3];
    const revenue = row[4];
    const month = row[6];
    const status = row[7];
    const amountTTC = row[9];
    const amountHT = row[11];

    if (!invoiceNum || month !== targetMonthStr) continue;

    const priceHT = amountHT ? parseFloat(String(amountHT).replace(/[^\d,.-]/g, '').replace(',', '.')) : null;
    const priceTTC = amountTTC ? parseFloat(String(amountTTC).replace(/[^\d,.-]/g, '').replace(',', '.')) : null;

    const centreConfig = CENTRES.find(c => c.billingName === centre);

    invoiceRows.push({
      invoiceNumber: invoiceNum,
      type,
      centre,
      games: parseInt(games),
      revenue: revenue || '',
      status,
      priceHT: type === 'in-app' ? priceHT : priceHT, // both have HT in column L
      priceTTC,
      customerID: centreConfig?.customerID || null,
      mandateID: null, // not needed for --invoices mode
    });

    console.log(`  ${invoiceNum.padEnd(25)} ${type.padEnd(8)} ${centre.padEnd(35)} HT: ${amountHT}`);
  }
  console.log(`\n  Found ${invoiceRows.length} invoices for ${targetMonthStr}\n`);
  return invoiceRows;
}

// ── MAIN ────────────────────────────────────────────────────
async function main() {
  const sheets = google.sheets({ version: 'v4', auth: await sheetsAuth.getClient() });

  if (INVOICES_ONLY) {
    // Only do step 4: PDFs + Firebase + Drive + Firestore docs
    const invoiceRows = await loadInvoicesFromSheet(sheets);

    if (invoiceRows.length === 0) {
      console.log('No invoices found in sheet for this month. Done!');
      process.exit(0);
    }

    await generatePDFs(sheets, invoiceRows);

    console.log(`${'='.repeat(60)}`);
    console.log(`  INVOICES STEP COMPLETE — ${billingMonthName} ${billingYear}`);
    console.log(`  ${invoiceRows.length} invoice PDFs processed`);
    console.log(`${'='.repeat(60)}\n`);

    process.exit(0);
  }

  if (CHARGE_ONLY) {
    // Step 5 alone, against the rows already written to the Billing sheet.
    const invoiceRows = await loadInvoicesFromSheet(sheets);
    if (invoiceRows.length === 0) {
      console.log('No invoices found in the sheet for this month. Nothing to charge.');
      process.exit(0);
    }

    // loadInvoicesFromSheet leaves mandateID null (--invoices mode never needs
    // it). Resolve each one here from the sheet's Mandate column -- the value
    // there is the GoCardless CUSTOMER id, so look up that customer's active
    // mandate. Reading the sheet rather than config.js keeps one source of
    // truth: if the two ever drift, the sheet Tim maintains is the one that
    // wins.
    const mandates = await gcClient.mandates.list({ status: 'active', limit: 100 });
    const mandateByCustomer = {};
    for (const m of mandates.mandates) mandateByCustomer[m.links.customer] = m.id;

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: BILLING_SHEET_ID,
      range: 'Invoices!A1:U500',
    });
    const sheetRows = sheetData.data.values || [];
    const customerByInvoice = {};
    for (const row of sheetRows.slice(1)) {
      if (row[0]) customerByInvoice[row[0]] = (row[14] || '').trim(); // col O
    }

    let unresolved = 0;
    for (const inv of invoiceRows) {
      if (inv.type !== 'on site') continue;
      const customerID = customerByInvoice[inv.invoiceNumber];
      inv.mandateID = customerID ? mandateByCustomer[customerID] : null;
      if (!inv.mandateID) {
        console.log(`  ⚠️  ${inv.invoiceNumber} (${inv.centre}): no active mandate for customer ${customerID || '(blank in column O)'} — will be SKIPPED`);
        unresolved++;
      }
    }
    if (unresolved > 0) {
      console.log(`\n  ${unresolved} on-site invoice(s) could not be matched to a mandate. Aborting rather than charging a partial run.`);
      process.exit(1);
    }

    // Refuse to charge a month whose invoices are already marked paid.
    const alreadyPaid = invoiceRows.filter(i => i.type === 'on site' && String(i.status).toLowerCase() === 'paid');
    if (alreadyPaid.length > 0) {
      console.log(`\n  ⚠️  ${alreadyPaid.length} on-site invoice(s) are already marked "paid" in the sheet:`);
      alreadyPaid.forEach(i => console.log(`      ${i.invoiceNumber}  ${i.centre}`));
      console.log('  Aborting: this month looks charged already. Clear the status or charge by hand.');
      process.exit(1);
    }

    await createPayments(invoiceRows, null);

    console.log(`${'='.repeat(60)}`);
    console.log(`  CHARGE STEP COMPLETE — ${billingMonthName} ${billingYear}`);
    console.log(`${'='.repeat(60)}\n`);
    process.exit(0);
  }

  // Full flow
  // Step 1: Query Firestore
  const results = await queryGames();

  // Step 2: Update Reporting sheet
  await updateReporting(sheets, results);

  // Step 3: Calculate billing and update Invoices
  const { invoiceRows, mandateMap } = await updateBilling(sheets, results);

  if (invoiceRows.length === 0) {
    console.log('No invoices to create. Done!');
    process.exit(0);
  }

  // Step 4: Generate PDFs and upload to Firebase
  await generatePDFs(sheets, invoiceRows);

  // Step 5: Create GoCardless payments
  if (NO_CHARGE) {
    const onSite = invoiceRows.filter(i => i.type === 'on site');
    const totalTTC = onSite.reduce((sum, i) => sum + (i.priceTTC || 0), 0);
    console.log('💳 Step 5: SKIPPED (--no-charge)\n');
    console.log(`  ${onSite.length} on-site invoices left uncharged, ${formatEur(Math.round(totalTTC * 100) / 100)} TTC.`);
    console.log('  Re-run without --no-charge to create the GoCardless payments.\n');
  } else {
    await createPayments(invoiceRows, mandateMap);
  }

  // Summary
  console.log(`${'='.repeat(60)}`);
  console.log(`  BILLING COMPLETE — ${billingMonthName} ${billingYear}`);
  console.log(`  ${invoiceRows.length} invoices created`);
  console.log(`  ${invoiceRows.filter(i => i.type === 'on site').length} on-site payments ${NO_CHARGE ? 'NOT charged (--no-charge)' : 'initiated'}`);
  console.log(`  ${invoiceRows.filter(i => i.type === 'in-app').length} in-app invoices recorded`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
