const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function exportAlertsCentres() {
    console.log('Fetching alerts_centres...');
    const snapshot = await db.collection('alerts_centres').get();
    console.log(`Found ${snapshot.size} documents`);

    const rows = [];
    rows.push('doc_id,centre,total_unique_alerts');

    snapshot.forEach(doc => {
        const data = doc.data();
        // Escape commas and quotes in centre name for CSV
        const centre = (data.centre || '').replace(/"/g, '""');
        const totalAlerts = data.total_unique_alerts || 0;
        rows.push(`${doc.id},"${centre}",${totalAlerts}`);
    });

    const csvContent = '\uFEFF' + rows.join('\n'); // BOM for UTF-8 Excel compatibility
    const filename = `alerts_centres_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    fs.writeFileSync(filename, csvContent, 'utf8');
    console.log(`Exported to ${filename}`);
    process.exit(0);
}

exportAlertsCentres();
