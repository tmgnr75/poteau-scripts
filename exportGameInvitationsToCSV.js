const admin = require('firebase-admin');
const fs = require('fs');
const { parse } = require('json2csv');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toISOString().replace('T', ' ').split('.')[0]; // Format: YYYY-MM-DD HH:mm:ss
}

async function exportGameInvitationsToCSV() {
  try {
    console.log('Starting exportGameInvitationsToCSV script...');
    
    // Get the timestamp for 24 hours ago
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    console.log(`Current time: ${now.toISOString()}`);
    console.log(`Filtering documents created between: ${twentyFourHoursAgo.toISOString()} and ${now.toISOString()}`);
    
    // Query Firestore for game_invitations created in the last 24 hours
    const invitationsRef = db.collection('game_invitations');
    const querySnapshot = await invitationsRef
      .where('created', '>=', admin.firestore.Timestamp.fromDate(twentyFourHoursAgo))
      .where('created', '<', admin.firestore.Timestamp.fromDate(now))
      .get();
    
    const data = [];
    querySnapshot.forEach(doc => {
      const docData = doc.data();
      data.push({
        'Game Invitation ID': doc.id,
        'Invitee': docData.invitee?.id || '',
        'Status': docData.status || '',
        'Game': docData.game?.id || '',
        'Source': docData.source || '',
        'Created': formatTimestamp(docData.created_at),
      });
    });

    if (data.length === 0) {
      console.log('No game_invitations found in the last 24 hours.');
      return;
    }

    // Convert JSON to CSV
    const csv = parse(data, { fields: ['Game Invitation ID', 'Invitee', 'Status', 'Game', 'Source', 'Created'] });
    
    // Save CSV to a file
    const filePath = `game_invitations_${now.toISOString().replace(/[:.]/g, '-')}.csv`;
    fs.writeFileSync(filePath, csv);
    console.log(`CSV file created successfully: ${filePath}`);
  } catch (error) {
    console.error('Error exporting game_invitations:', error);
  }
}

exportGameInvitationsToCSV();