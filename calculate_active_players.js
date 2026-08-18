const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json'));
const PROJECT_ID = 'krank-club'; // Replace with your project ID

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: PROJECT_ID,
});

const db = admin.firestore();

async function countUniqueAttendees() {
  try {
    const startDate = new Date('2026-05-01T00:00:00Z');
    const endDate = new Date('2026-06-01T00:00:00Z');

    const querySnapshot = await db
      .collection('games')
      .where('status', '==', 'played')
      .where('date', '>=', startDate)
      .where('date', '<', endDate)
      .get();

    const soccerPlayers = new Set();
    const padelPlayers = new Set();
    const usaPlayers = new Set();
    const totalPlayers = new Set();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const attendees = data.attendees || [];
      const sport = data.sport || 'soccer';
      const currency = data.currency;

      attendees.forEach((attendee) => {
        const playerId = attendee.id;
        totalPlayers.add(playerId);

        if (sport === 'soccer') {
          soccerPlayers.add(playerId);
        } else if (sport === 'padel') {
          padelPlayers.add(playerId);
        }

        if (currency === 'USD') {
          usaPlayers.add(playerId);
        }
      });
    });

    console.log(`\n📊 Active Players in May 2026:`);
    console.log(`   ⚽ Soccer players: ${soccerPlayers.size}`);
    console.log(`   🎾 Padel players: ${padelPlayers.size}`);
    console.log(`   🇺🇸  U.S.A. players: ${usaPlayers.size}`);
    console.log(`   👥 Total unique players: ${totalPlayers.size}\n`);

    return {
      soccer: soccerPlayers.size,
      padel: padelPlayers.size,
      usa: usaPlayers.size,
      total: totalPlayers.size,
    };
  } catch (error) {
    console.error('Error counting unique attendees:', error);
    throw error;
  }
}

countUniqueAttendees();