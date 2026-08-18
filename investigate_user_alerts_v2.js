// investigate_user_alerts_v2.js
// Focused investigation on 4PADEL Montreuil games and invitations

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const USER_ID = 'XNPognOy0OgAklzAAknSsuvjTwN2';
const SINCE_DATE = new Date('2025-11-15T00:00:00Z');

(async () => {
  try {
    console.log('='.repeat(80));
    console.log(`FOCUSED INVESTIGATION: USER ${USER_ID}`);
    console.log(`SINCE: ${SINCE_DATE.toISOString()}`);
    console.log('='.repeat(80));

    const userRef = db.collection('users').doc(USER_ID);

    // 1. Get user's alert settings
    console.log('\n\n📋 USER ALERT SETTINGS');
    console.log('-'.repeat(40));

    const alertsByUserRef = await db.collection('alerts')
      .where('user', '==', userRef)
      .get();

    let montreuilAlertConfig = null;
    let alertDocId = null;

    alertsByUserRef.forEach(doc => {
      const data = doc.data();
      console.log(`\nAlert Doc ID: ${doc.id}`);
      console.log('Created:', data.created ? data.created.toDate().toISOString() : 'N/A');
      console.log('Weekdays:', data.weekdays ? data.weekdays.sort((a, b) => a - b).join(', ') : 'N/A');
      console.log('Times:', data.times ? data.times.sort().join(', ') : 'N/A');

      if (data.places) {
        data.places.forEach((place) => {
          const isMontreuil = place.centre && place.centre.toLowerCase().includes('montreuil');
          console.log(`  - ${place.centre} ${isMontreuil ? '⭐ TARGET' : ''}`);
          if (isMontreuil) {
            montreuilAlertConfig = {
              docId: doc.id,
              weekdays: data.weekdays || [],
              times: data.times || [],
              created: data.created ? data.created.toDate() : null,
              placeId: place.placeId
            };
            alertDocId = doc.id;
          }
        });
      }
    });

    if (montreuilAlertConfig) {
      console.log('\n✅ USER HAS ALERT FOR 4PADEL MONTREUIL');
      console.log(`   Alert Doc: ${montreuilAlertConfig.docId}`);
      console.log(`   Created: ${montreuilAlertConfig.created ? montreuilAlertConfig.created.toISOString() : 'N/A'}`);
      console.log(`   Weekdays: ${montreuilAlertConfig.weekdays.sort((a, b) => a - b).join(', ')}`);
      console.log(`   Times: ${montreuilAlertConfig.times.sort().join(', ')}`);
    } else {
      console.log('\n❌ USER HAS NO ALERT SET FOR 4PADEL MONTREUIL');
    }

    // 2. Get all games at 4PADEL Montreuil since Nov 15
    console.log('\n\n⚽ GAMES AT 4PADEL MONTREUIL');
    console.log('-'.repeat(40));

    const gamesSnapshot = await db.collection('games')
      .where('date', '>=', SINCE_DATE)
      .orderBy('date', 'asc')
      .get();

    const montreuilGames = [];
    gamesSnapshot.forEach(doc => {
      const data = doc.data();
      const centre = data.centre || data.location || '';
      // Match both "4PADEL Montreuil" and variations
      if (centre.toLowerCase().includes('montreuil') && centre.toLowerCase().includes('padel')) {
        montreuilGames.push({
          id: doc.id,
          date: data.date ? data.date.toDate() : null,
          centre: centre,
          status: data.status || 'N/A',
          sport: data.sport || 'N/A',
          organizer: data.organizer ? data.organizer.id : null,
          slots: data.slots || 'N/A',
          attendeesCount: data.attendees ? data.attendees.length : 0,
          isUserOrganizer: data.organizer && data.organizer.id === USER_ID,
          isUserAttendee: data.attendees && data.attendees.some(a => a.id === USER_ID),
        });
      }
    });

    console.log(`Total games found: ${montreuilGames.length}`);

    // 3. Get game_invitations for user at Montreuil
    console.log('\n\n🎮 GAME INVITATIONS FOR USER');
    console.log('-'.repeat(40));

    const invitationsSnapshot = await db.collection('game_invitations')
      .where('invitee', '==', userRef)
      .where('created', '>=', SINCE_DATE)
      .orderBy('created', 'asc')
      .get();

    const invitations = [];
    for (const doc of invitationsSnapshot.docs) {
      const data = doc.data();
      let gameData = null;

      if (data.game) {
        const gameDoc = await data.game.get();
        if (gameDoc.exists) {
          gameData = gameDoc.data();
        }
      }

      const gameCentre = gameData ? (gameData.centre || gameData.location || '') : '';
      const isMontreuil = gameCentre.toLowerCase().includes('montreuil') && gameCentre.toLowerCase().includes('padel');

      if (isMontreuil) {
        invitations.push({
          id: doc.id,
          created: data.created ? data.created.toDate() : null,
          status: data.status || 'N/A',
          source: data.source || 'N/A',
          gameId: data.game ? data.game.id : null,
          gameCentre: gameCentre,
          gameDate: gameData && gameData.date ? gameData.date.toDate() : null,
        });
      }
    }

    console.log(`Montreuil invitations found: ${invitations.length}`);

    // 4. Get connect docs for user related to Montreuil
    console.log('\n\n📬 CONNECT DOCS (Notifications) FOR MONTREUIL');
    console.log('-'.repeat(40));

    const connectSnapshot = await db.collection('connect')
      .where('recipient', 'array-contains', userRef)
      .where('datetime', '>=', SINCE_DATE)
      .orderBy('datetime', 'asc')
      .get();

    const montreuilConnects = [];
    connectSnapshot.forEach(doc => {
      const data = doc.data();
      const message = data.message || '';
      const title = data.title || '';
      const destination = data.destination || '';

      if (message.toLowerCase().includes('montreuil') ||
          title.toLowerCase().includes('montreuil') ||
          destination.toLowerCase().includes('montreuil')) {
        montreuilConnects.push({
          id: doc.id,
          datetime: data.datetime ? data.datetime.toDate() : null,
          title: title,
          message: message,
          source: data.source || 'N/A',
          gameId: data.game ? data.game.id : null,
        });
      }
    });

    console.log(`Montreuil-related connect docs: ${montreuilConnects.length}`);

    // 5. Cross-reference analysis
    console.log('\n\n' + '='.repeat(80));
    console.log('DETAILED CROSS-REFERENCE: GAMES vs INVITATIONS vs NOTIFICATIONS');
    console.log('='.repeat(80));

    const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Only consider games since the alert was created
    const alertCreatedDate = montreuilAlertConfig ? montreuilAlertConfig.created : null;

    for (const game of montreuilGames) {
      if (!game.date) continue;

      const gameDay = game.date.getDay();
      const adjustedGameDay = gameDay === 0 ? 7 : gameDay; // Convert Sunday from 0 to 7
      const gameHour = game.date.getHours();
      const gameMinutes = game.date.getMinutes();
      const gameTimeStr = `${gameHour.toString().padStart(2, '0')}:${gameMinutes.toString().padStart(2, '0')}`;

      // Check if this game is after alert was created
      const isAfterAlertCreated = alertCreatedDate ? game.date >= alertCreatedDate : false;

      // Check if day matches user preferences
      const dayMatches = montreuilAlertConfig ? montreuilAlertConfig.weekdays.includes(adjustedGameDay) : false;

      // Check if time matches (exact match or within 30 min)
      const timeMatches = montreuilAlertConfig ? montreuilAlertConfig.times.includes(gameTimeStr) : false;

      // Should user have been invited?
      const shouldHaveBeenInvited = isAfterAlertCreated && dayMatches && timeMatches && !game.isUserOrganizer;

      // Was user actually invited?
      const wasInvited = invitations.some(inv => inv.gameId === game.id);
      const invitationDoc = invitations.find(inv => inv.gameId === game.id);

      // Did user receive a connect notification?
      const receivedConnect = montreuilConnects.some(c => c.gameId === game.id);
      const connectDoc = montreuilConnects.find(c => c.gameId === game.id);

      // Only show relevant games
      if (shouldHaveBeenInvited || wasInvited || receivedConnect || game.isUserOrganizer || game.isUserAttendee) {
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`GAME: ${game.id}`);
        console.log(`  Date: ${game.date.toISOString()}`);
        console.log(`  Day: ${dayNames[adjustedGameDay]} (${adjustedGameDay})`);
        console.log(`  Time: ${gameTimeStr}`);
        console.log(`  Centre: ${game.centre}`);
        console.log(`  Status: ${game.status}`);
        console.log(`  Sport: ${game.sport}`);
        console.log(`  Organizer: ${game.isUserOrganizer ? 'USER IS ORGANIZER' : game.organizer}`);
        console.log(`  User is attendee: ${game.isUserAttendee ? 'YES' : 'NO'}`);
        console.log('');
        console.log(`  📅 Alert created: ${alertCreatedDate ? alertCreatedDate.toISOString() : 'N/A'}`);
        console.log(`  📅 Game after alert: ${isAfterAlertCreated ? 'YES' : 'NO'}`);
        console.log(`  📅 Day matches preferences: ${dayMatches ? 'YES' : 'NO'} (user has: ${montreuilAlertConfig ? montreuilAlertConfig.weekdays.sort((a,b)=>a-b).join(',') : 'none'})`);
        console.log(`  ⏰ Time matches preferences: ${timeMatches ? 'YES' : 'NO'} (user has: ${montreuilAlertConfig ? montreuilAlertConfig.times.sort().join(',') : 'none'})`);
        console.log('');
        console.log(`  ✅ SHOULD HAVE BEEN INVITED: ${shouldHaveBeenInvited ? 'YES' : 'NO'}`);
        console.log(`  📨 WAS ACTUALLY INVITED: ${wasInvited ? 'YES' : 'NO'}`);
        if (invitationDoc) {
          console.log(`     Invitation ID: ${invitationDoc.id}`);
          console.log(`     Invitation created: ${invitationDoc.created ? invitationDoc.created.toISOString() : 'N/A'}`);
          console.log(`     Invitation source: ${invitationDoc.source}`);
          console.log(`     Invitation status: ${invitationDoc.status}`);
        }
        console.log(`  🔔 RECEIVED CONNECT NOTIFICATION: ${receivedConnect ? 'YES' : 'NO'}`);
        if (connectDoc) {
          console.log(`     Connect ID: ${connectDoc.id}`);
          console.log(`     Connect datetime: ${connectDoc.datetime ? connectDoc.datetime.toISOString() : 'N/A'}`);
          console.log(`     Connect title: ${connectDoc.title}`);
          console.log(`     Connect source: ${connectDoc.source}`);
        }

        // Flag mismatches
        if (shouldHaveBeenInvited && !wasInvited) {
          console.log('');
          console.log(`  ⚠️  MISMATCH: User should have been invited but was NOT!`);
        }
        if (wasInvited && !receivedConnect) {
          console.log('');
          console.log(`  ⚠️  MISMATCH: User was invited but did NOT receive connect notification!`);
        }
      }
    }

    // 6. Summary statistics
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const gamesAfterAlert = montreuilGames.filter(g => g.date && alertCreatedDate && g.date >= alertCreatedDate);
    const gamesMatchingCriteria = gamesAfterAlert.filter(g => {
      if (!g.date) return false;
      const gameDay = g.date.getDay();
      const adjustedGameDay = gameDay === 0 ? 7 : gameDay;
      const gameTimeStr = `${g.date.getHours().toString().padStart(2, '0')}:${g.date.getMinutes().toString().padStart(2, '0')}`;
      const dayMatches = montreuilAlertConfig ? montreuilAlertConfig.weekdays.includes(adjustedGameDay) : false;
      const timeMatches = montreuilAlertConfig ? montreuilAlertConfig.times.includes(gameTimeStr) : false;
      return dayMatches && timeMatches && !g.isUserOrganizer;
    });

    console.log(`\nAlert created: ${alertCreatedDate ? alertCreatedDate.toISOString() : 'N/A'}`);
    console.log(`Total 4PADEL Montreuil games since Nov 15: ${montreuilGames.length}`);
    console.log(`Games after alert was created: ${gamesAfterAlert.length}`);
    console.log(`Games matching user's criteria (day+time): ${gamesMatchingCriteria.length}`);
    console.log(`Montreuil invitations received: ${invitations.length}`);
    console.log(`Montreuil connect notifications: ${montreuilConnects.length}`);

    // Find misses
    const missedGames = gamesMatchingCriteria.filter(g => !invitations.some(inv => inv.gameId === g.id));
    console.log(`\n❌ GAMES USER SHOULD HAVE BEEN INVITED TO BUT WASN'T: ${missedGames.length}`);
    missedGames.forEach(g => {
      console.log(`   - ${g.id}: ${g.date ? g.date.toISOString() : 'N/A'} (${g.status})`);
    });

    // Invitations received
    console.log(`\n✅ GAMES USER WAS INVITED TO: ${invitations.length}`);
    invitations.forEach(inv => {
      console.log(`   - ${inv.gameId}: ${inv.gameDate ? inv.gameDate.toISOString() : 'N/A'} (source: ${inv.source}, status: ${inv.status})`);
    });

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    process.exit();
  }
})();
