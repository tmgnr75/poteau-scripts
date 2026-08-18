// investigate_user_alerts.js
// Investigates why a specific user isn't receiving alerts/notifications/invitations

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const USER_ID = 'XNPognOy0OgAklzAAknSsuvjTwN2';
const TARGET_CENTRE = '4PADEL Montreuil';
const SINCE_DATE = new Date('2025-11-15T00:00:00Z');

(async () => {
  try {
    console.log('='.repeat(80));
    console.log(`INVESTIGATION FOR USER: ${USER_ID}`);
    console.log(`TARGET CENTRE: ${TARGET_CENTRE}`);
    console.log(`SINCE: ${SINCE_DATE.toISOString()}`);
    console.log('='.repeat(80));

    // 1. Fetch user document
    console.log('\n\n📋 USER DOCUMENT');
    console.log('-'.repeat(40));
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('User exists: YES');
      console.log('Display Name:', userData.display_name || 'N/A');
      console.log('Email:', userData.email || 'N/A');
      console.log('Phone:', userData.phone_number || 'N/A');
      console.log('FCM Tokens:', userData.fcm_tokens ? userData.fcm_tokens.length : 0);
      if (userData.fcm_tokens && userData.fcm_tokens.length > 0) {
        userData.fcm_tokens.forEach((token, idx) => {
          console.log(`  Token ${idx + 1}:`, token.substring(0, 30) + '...');
        });
      }
      console.log('Notification Settings:', JSON.stringify(userData.notification_settings || {}, null, 2));
      console.log('Created:', userData.created_time ? userData.created_time.toDate() : 'N/A');
    } else {
      console.log('User exists: NO - USER NOT FOUND!');
    }

    // 2. Fetch user's alert preferences
    console.log('\n\n🔔 USER ALERT PREFERENCES');
    console.log('-'.repeat(40));
    const userRef = db.collection('users').doc(USER_ID);

    // Alert document ID is typically the user ID
    const alertDoc = await db.collection('alerts').doc(USER_ID).get();

    if (alertDoc.exists) {
      const alertData = alertDoc.data();
      console.log('Alert document exists: YES');
      console.log('Created:', alertData.created ? alertData.created.toDate() : 'N/A');
      console.log('Weekdays:', alertData.weekdays ? alertData.weekdays.join(', ') : 'N/A');
      console.log('Times:', alertData.times ? alertData.times.join(', ') : 'N/A');
      console.log('\nPlaces configured:');
      if (alertData.places && alertData.places.length > 0) {
        alertData.places.forEach((place, idx) => {
          const isTargetCentre = place.centre && place.centre.toLowerCase().includes('montreuil');
          console.log(`  ${idx + 1}. ${place.centre || 'N/A'} (placeId: ${place.placeId || 'N/A'}) ${isTargetCentre ? '⭐ TARGET' : ''}`);
        });
      } else {
        console.log('  No places configured!');
      }
    } else {
      console.log('Alert document exists: NO - User has no alert preferences set!');
    }

    // Also query alerts collection by user field (in case document ID differs)
    console.log('\n\nQuerying alerts by user reference...');
    const alertsByUserRef = await db.collection('alerts')
      .where('user', '==', userRef)
      .get();

    console.log(`Found ${alertsByUserRef.size} alert(s) by user reference`);
    alertsByUserRef.forEach(doc => {
      const data = doc.data();
      console.log(`\nAlert Doc ID: ${doc.id}`);
      console.log('Created:', data.created ? data.created.toDate() : 'N/A');
      console.log('Weekdays:', data.weekdays ? data.weekdays.join(', ') : 'N/A');
      console.log('Times:', data.times ? data.times.join(', ') : 'N/A');
      if (data.places) {
        console.log('Places:');
        data.places.forEach((place, idx) => {
          const isTargetCentre = place.centre && place.centre.toLowerCase().includes('montreuil');
          console.log(`  ${idx + 1}. ${place.centre || 'N/A'} (placeId: ${place.placeId || 'N/A'}) ${isTargetCentre ? '⭐ TARGET' : ''}`);
        });
      }
    });

    // 3. Fetch connect documents where user is recipient
    console.log('\n\n📬 CONNECT DOCUMENTS (Notifications received)');
    console.log('-'.repeat(40));

    const connectSnapshot = await db.collection('connect')
      .where('recipient', 'array-contains', userRef)
      .where('datetime', '>=', SINCE_DATE)
      .orderBy('datetime', 'desc')
      .get();

    console.log(`Total connect docs for user since ${SINCE_DATE.toISOString()}: ${connectSnapshot.size}`);

    const connectDocs = [];
    connectSnapshot.forEach(doc => {
      const data = doc.data();
      connectDocs.push({
        id: doc.id,
        datetime: data.datetime ? data.datetime.toDate() : null,
        title: data.title || 'N/A',
        message: data.message || 'N/A',
        source: data.source || 'N/A',
        status: data.status || 'N/A',
        game: data.game ? data.game.path : null,
        destination: data.destination || 'N/A',
      });
    });

    // Filter for Montreuil-related
    const montreuilConnects = connectDocs.filter(c =>
      (c.message && c.message.toLowerCase().includes('montreuil')) ||
      (c.title && c.title.toLowerCase().includes('montreuil')) ||
      (c.destination && c.destination.toLowerCase().includes('montreuil'))
    );

    console.log(`\nMontreuil-related connect docs: ${montreuilConnects.length}`);

    console.log('\n--- ALL CONNECT DOCS ---');
    connectDocs.forEach((c, idx) => {
      console.log(`\n${idx + 1}. [${c.datetime ? c.datetime.toISOString() : 'No date'}]`);
      console.log(`   Title: ${c.title}`);
      console.log(`   Message: ${c.message.substring(0, 100)}${c.message.length > 100 ? '...' : ''}`);
      console.log(`   Source: ${c.source}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Game: ${c.game || 'N/A'}`);
    });

    // 4. Fetch game_invitations where user is invitee
    console.log('\n\n🎮 GAME INVITATIONS');
    console.log('-'.repeat(40));

    const invitationsSnapshot = await db.collection('game_invitations')
      .where('invitee', '==', userRef)
      .where('created', '>=', SINCE_DATE)
      .orderBy('created', 'desc')
      .get();

    console.log(`Total game invitations since ${SINCE_DATE.toISOString()}: ${invitationsSnapshot.size}`);

    const invitations = [];
    for (const doc of invitationsSnapshot.docs) {
      const data = doc.data();
      let gameData = null;
      let gameCentre = null;

      if (data.game) {
        const gameDoc = await data.game.get();
        if (gameDoc.exists) {
          gameData = gameDoc.data();
          gameCentre = gameData.centre || gameData.location || 'N/A';
        }
      }

      invitations.push({
        id: doc.id,
        created: data.created ? data.created.toDate() : null,
        status: data.status || 'N/A',
        source: data.source || 'N/A',
        game: data.game ? data.game.path : null,
        gameCentre: gameCentre,
        gameDate: gameData && gameData.date ? gameData.date.toDate() : null,
        inviter: data.inviter ? data.inviter.path : null,
      });
    }

    // Filter for alerts-triggered invitations
    const alertInvitations = invitations.filter(inv => inv.source === 'alerts');
    const montreuilInvitations = invitations.filter(inv =>
      inv.gameCentre && inv.gameCentre.toLowerCase().includes('montreuil')
    );

    console.log(`Alert-triggered invitations: ${alertInvitations.length}`);
    console.log(`Montreuil-related invitations: ${montreuilInvitations.length}`);

    console.log('\n--- ALL GAME INVITATIONS ---');
    invitations.forEach((inv, idx) => {
      const isMontreuil = inv.gameCentre && inv.gameCentre.toLowerCase().includes('montreuil');
      console.log(`\n${idx + 1}. [${inv.created ? inv.created.toISOString() : 'No date'}] ${isMontreuil ? '⭐ MONTREUIL' : ''}`);
      console.log(`   Status: ${inv.status}`);
      console.log(`   Source: ${inv.source}`);
      console.log(`   Game: ${inv.game || 'N/A'}`);
      console.log(`   Game Centre: ${inv.gameCentre || 'N/A'}`);
      console.log(`   Game Date: ${inv.gameDate ? inv.gameDate.toISOString() : 'N/A'}`);
    });

    // 5. Fetch games at 4PADEL Montreuil since the date
    console.log('\n\n⚽ GAMES AT 4PADEL MONTREUIL (What user SHOULD have been notified about)');
    console.log('-'.repeat(40));

    // First, find games with centre containing "montreuil"
    const gamesSnapshot = await db.collection('games')
      .where('date', '>=', SINCE_DATE)
      .orderBy('date', 'desc')
      .get();

    const montreuilGames = [];
    gamesSnapshot.forEach(doc => {
      const data = doc.data();
      const centre = data.centre || data.location || '';
      if (centre.toLowerCase().includes('montreuil') || centre.toLowerCase().includes('4padel')) {
        montreuilGames.push({
          id: doc.id,
          date: data.date ? data.date.toDate() : null,
          centre: centre,
          status: data.status || 'N/A',
          sport: data.sport || 'N/A',
          organizer: data.organizer ? data.organizer.path : null,
          slots: data.slots || 'N/A',
          attendeesCount: data.attendees ? data.attendees.length : 0,
        });
      }
    });

    console.log(`Total games at 4PADEL Montreuil since ${SINCE_DATE.toISOString()}: ${montreuilGames.length}`);

    console.log('\n--- MONTREUIL GAMES ---');
    montreuilGames.forEach((game, idx) => {
      console.log(`\n${idx + 1}. [${game.date ? game.date.toISOString() : 'No date'}]`);
      console.log(`   ID: ${game.id}`);
      console.log(`   Centre: ${game.centre}`);
      console.log(`   Status: ${game.status}`);
      console.log(`   Sport: ${game.sport}`);
      console.log(`   Slots: ${game.slots}, Attendees: ${game.attendeesCount}`);
    });

    // 6. Cross-reference: which games should user have been invited to?
    console.log('\n\n🔍 CROSS-REFERENCE ANALYSIS');
    console.log('-'.repeat(40));

    // Get user's alert settings
    let userAlertSettings = null;
    if (alertDoc.exists) {
      userAlertSettings = alertDoc.data();
    } else if (alertsByUserRef.size > 0) {
      userAlertSettings = alertsByUserRef.docs[0].data();
    }

    if (userAlertSettings) {
      const userWeekdays = userAlertSettings.weekdays || [];
      const userTimes = userAlertSettings.times || [];
      const userPlaces = userAlertSettings.places || [];

      const montreuil4PadelPlace = userPlaces.find(p =>
        p.centre && (p.centre.toLowerCase().includes('montreuil') || p.centre.toLowerCase().includes('4padel'))
      );

      console.log('\nUser alert settings for 4PADEL Montreuil:');
      if (montreuil4PadelPlace) {
        console.log(`  Centre: ${montreuil4PadelPlace.centre}`);
        console.log(`  Place ID: ${montreuil4PadelPlace.placeId}`);
        console.log(`  Weekdays: ${userWeekdays.join(', ')}`);
        console.log(`  Times: ${userTimes.join(', ')}`);
      } else {
        console.log('  ⚠️ USER HAS NO ALERT SET FOR 4PADEL MONTREUIL!');
      }

      // Check which games matched user's criteria
      console.log('\n\nGames that SHOULD have triggered an invitation:');
      let matchingGamesCount = 0;

      montreuilGames.forEach(game => {
        if (!game.date) return;

        const gameDay = game.date.getDay(); // 0=Sunday, 1=Monday, etc.
        const gameHour = game.date.getHours();
        const gameMinutes = game.date.getMinutes();
        const gameTimeStr = `${gameHour.toString().padStart(2, '0')}:${gameMinutes.toString().padStart(2, '0')}`;

        // Check if game day matches user's weekdays (assuming 1=Monday, 7=Sunday)
        const adjustedGameDay = gameDay === 0 ? 7 : gameDay;
        const dayMatches = userWeekdays.includes(adjustedGameDay);

        // Check if game time matches (within user's time preferences)
        const timeMatches = userTimes.some(t => {
          const [h, m] = t.split(':').map(Number);
          const diffMins = Math.abs((gameHour * 60 + gameMinutes) - (h * 60 + m));
          return diffMins <= 30; // Within 30 minutes
        });

        const shouldHaveBeenInvited = montreuil4PadelPlace && dayMatches && timeMatches;

        // Check if user was actually invited
        const wasInvited = invitations.some(inv => inv.game && inv.game.includes(game.id));
        const receivedConnect = connectDocs.some(c => c.game && c.game.includes(game.id));

        if (shouldHaveBeenInvited || wasInvited || receivedConnect) {
          matchingGamesCount++;
          console.log(`\n  Game ID: ${game.id}`);
          console.log(`    Date: ${game.date.toISOString()}`);
          console.log(`    Day: ${adjustedGameDay} (${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][adjustedGameDay]})`);
          console.log(`    Time: ${gameTimeStr}`);
          console.log(`    Day matches user prefs: ${dayMatches ? 'YES' : 'NO'}`);
          console.log(`    Time matches user prefs: ${timeMatches ? 'YES' : 'NO'}`);
          console.log(`    Should have been invited: ${shouldHaveBeenInvited ? 'YES' : 'NO'}`);
          console.log(`    WAS INVITED: ${wasInvited ? '✅ YES' : '❌ NO'}`);
          console.log(`    RECEIVED CONNECT: ${receivedConnect ? '✅ YES' : '❌ NO'}`);
        }
      });

      if (matchingGamesCount === 0) {
        console.log('  No matching games found or no invitations expected.');
      }
    } else {
      console.log('⚠️ Cannot perform cross-reference - user has no alert settings!');
    }

    // 7. Summary
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log(`User ID: ${USER_ID}`);
    console.log(`User exists: ${userDoc.exists ? 'YES' : 'NO'}`);
    console.log(`Has alert preferences: ${(alertDoc.exists || alertsByUserRef.size > 0) ? 'YES' : 'NO'}`);
    console.log(`Total connect notifications received: ${connectDocs.length}`);
    console.log(`Total game invitations received: ${invitations.length}`);
    console.log(`Alert-triggered invitations: ${alertInvitations.length}`);
    console.log(`Montreuil-related invitations: ${montreuilInvitations.length}`);
    console.log(`Games at 4PADEL Montreuil in period: ${montreuilGames.length}`);

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    process.exit();
  }
})();
