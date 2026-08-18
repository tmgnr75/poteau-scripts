const { google } = require('googleapis');
const path = require('path');

const REPORTING_SHEET_ID = '1jkekhti9_9UgRCmsFN3ceINb5seakO-IqNl7BYHcYjk';
const BILLING_SHEET_ID = '1SDNSA_I0MCemhG5hOLNyn_8QhHLHHGEZ_def1btoRsY';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'Poteau Billing IAM Admin.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. List all tabs in both sheets
  console.log('=== REPORTING SHEET TABS ===');
  const reportingMeta = await sheets.spreadsheets.get({ spreadsheetId: REPORTING_SHEET_ID });
  for (const s of reportingMeta.data.sheets) {
    console.log(`  - "${s.properties.title}" (gid: ${s.properties.sheetId})`);
  }

  console.log('\n=== BILLING SHEET TABS ===');
  const billingMeta = await sheets.spreadsheets.get({ spreadsheetId: BILLING_SHEET_ID });
  for (const s of billingMeta.data.sheets) {
    console.log(`  - "${s.properties.title}" (gid: ${s.properties.sheetId})`);
  }

  // 2. Read Reporting > players tab
  console.log('\n=== REPORTING > players (first 5 rows, all columns) ===');
  const playersData = await sheets.spreadsheets.values.get({
    spreadsheetId: REPORTING_SHEET_ID,
    range: 'players!A1:Z50',
  });
  if (playersData.data.values) {
    playersData.data.values.slice(0, 50).forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 3. Read Reporting > indies tab
  console.log('\n=== REPORTING > indies (first 50 rows) ===');
  const indiesData = await sheets.spreadsheets.values.get({
    spreadsheetId: REPORTING_SHEET_ID,
    range: 'indies!A1:Z50',
  });
  if (indiesData.data.values) {
    indiesData.data.values.slice(0, 50).forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 4. Read Billing > Invoices tab
  console.log('\n=== BILLING > Invoices (first 30 rows) ===');
  const invoicesData = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Invoices!A1:Z30',
  });
  if (invoicesData.data.values) {
    invoicesData.data.values.slice(0, 30).forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 5. Read Billing > On-Site FR tab
  console.log('\n=== BILLING > On-Site FR ===');
  const onsiteData = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: "'On-Site FR'!A1:Z50",
  });
  if (onsiteData.data.values) {
    onsiteData.data.values.forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 6. Read Billing > In-App FR tab
  console.log('\n=== BILLING > In-App FR ===');
  const inappData = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: "'In-App FR'!A1:Z50",
  });
  if (inappData.data.values) {
    inappData.data.values.forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 7. Read Billing > Centres tab
  console.log('\n=== BILLING > Centres ===');
  const centresData = await sheets.spreadsheets.values.get({
    spreadsheetId: BILLING_SHEET_ID,
    range: 'Centres!A1:I30',
  });
  if (centresData.data.values) {
    centresData.data.values.forEach((row, i) => {
      console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
    });
  }

  // 8. Read Billing > Analysis tab if it exists
  try {
    console.log('\n=== BILLING > Analysis ===');
    const analysisData = await sheets.spreadsheets.values.get({
      spreadsheetId: BILLING_SHEET_ID,
      range: 'Analysis!A1:Z30',
    });
    if (analysisData.data.values) {
      analysisData.data.values.forEach((row, i) => {
        console.log(`Row ${i + 1}: ${JSON.stringify(row)}`);
      });
    }
  } catch (e) {
    console.log('  (tab not found or not readable)');
  }
}

main().catch(console.error);
