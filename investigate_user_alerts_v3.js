// investigate_user_alerts_v3.js
// Comprehensive investigation with proper timezone handling

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club',
});

const db = admin.firestore();

const USER_ID = 'XNPognOy0OgAklzAAknSsuvjTwN2';
const SINCE_DATE = new Date('2025-11-15T00:00:00Z');

// Helper to convert UTC to Paris time
function toParisTime(date) {
  if (!date) return null;
  return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}

function formatParisTime(date) {
  if (!date) return 'N/A';
  const options = {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  };
  return date.toLocaleString('fr-FR', options);
}

function getParisHourMinute(date) {
  if (!date) return { hour: 0, minute: 0 };
  const parisStr = date.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const [hour, minute] = parisStr.split(':').map(Number);
  return { hour, minute };
}

function getParisWeekday(date) {
  if (!date) return 0;
  const parisStr = date.toLocaleString('en-US', {
    timeZone: 'Europe/Paris',
    weekday: 'short'
  });
  const dayMap = { 'Sun': 7, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
  return dayMap[parisStr] || 0;
}

(async () => {
  try {
    console.log('='.repeat(80));
    console.log(`COMPREHENSIVE INVESTIGATION: USER ${USER_ID}`);
    console.log(`SINCE: ${SINCE_DATE.toISOString()}`);
    console.log('='.repeat(80));

    const userRef = db.collection('users').doc(USER_ID);

    // 1. Get user info
    console.log('\n\n👤 USER INFO');
    console.log('-'.repeat(40));
    const userDoc = await db.collection('users').doc(USER_ID).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log(`Name: ${userData.display_name || 'N/A'}`);
      console.log(`Email: ${userData.email || 'N/A'}`);
      console.log(`Phone: ${userData.phone_number || 'N/A'}`);
      console.log(`FCM Tokens: ${userData.fcm_tokens ? userData.fcm_tokens.length : 0}`);
    }

    // 2. Get user's alert settings
    console.log('\n\n📋 USER ALERT SETTINGS');
    console.log('-'.repeat(40));

    const alertsByUserRef = await db.collection('alerts')
      .where('user', '==', userRef)
      .get();

    let montreuilAlertConfig = null;

    alertsByUserRef.forEach(doc => {
      const data = doc.data();
      console.log(`\nAlert Doc ID: ${doc.id}`);
      console.log('Created:', formatParisTime(data.created ? data.created.toDate() : null));
      console.log('Weekdays:', data.weekdays ? data.weekdays.sort((a, b) => a - b).map(d => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ') : 'N/A');
      console.log('Times:', data.times ? data.times.sort().join(', ') : 'N/A');

      if (data.places) {
        console.log('Places:');
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
          }
        });
      }
    });

    if (montreuilAlertConfig) {
      console.log('\n✅ USER HAS ALERT FOR 4PADEL MONTREUIL');
      console.log(`   Alert created: ${formatParisTime(montreuilAlertConfig.created)}`);
      console.log(`   Weekdays: ${montreuilAlertConfig.weekdays.sort((a,b)=>a-b).map(d => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join(', ')}`);
      console.log(`   Time range: ${montreuilAlertConfig.times.sort()[0]} - ${montreuilAlertConfig.times.sort().slice(-1)[0]}`);
    } else {
      console.log('\n❌ USER HAS NO ALERT SET FOR 4PADEL MONTREUIL');
    }

    // 3. Get ALL games at 4PADEL Montreuil since Nov 15
    console.log('\n\n⚽ ALL GAMES AT 4PADEL MONTREUIL');
    console.log('-'.repeat(40));

    const gamesSnapshot = await db.collection('games')
      .where('date', '>=', SINCE_DATE)
      .orderBy('date', 'asc')
      .get();

    const montreuilGames = [];
    gamesSnapshot.forEach(doc => {
      const data = doc.data();
      const centre = data.centre || data.location || '';
      if (centre.toLowerCase().includes('montreuil') && centre.toLowerCase().includes('padel')) {
        const gameDate = data.date ? data.date.toDate() : null;
        montreuilGames.push({
          id: doc.id,
          date: gameDate,
          centre: centre,
          status: data.status || 'N/A',
          sport: data.sport || 'N/A',
          organizer: data.organizer ? data.organizer.id : null,
          slots: data.slots || 'N/A',
          attendeesCount: data.attendees ? data.attendees.length : 0,
          isUserOrganizer: data.organizer && data.organizer.id === USER_ID,
          isUserAttendee: data.attendees && data.attendees.some(a => a.id === USER_ID),
          interestedCount: data.interested ? data.interested.length : 0,
          isUserInterested: data.interested && data.interested.some(i => i.id === USER_ID),
        });
      }
    });

    console.log(`Total games found: ${montreuilGames.length}`);

    // 4. Get ALL game_invitations for user at Montreuil
    console.log('\n\n🎮 GAME INVITATIONS FOR MONTREUIL');
    console.log('-'.repeat(40));

    const invitationsSnapshot = await db.collection('game_invitations')
      .where('invitee', '==', userRef)
      .where('created', '>=', SINCE_DATE)
      .orderBy('created', 'asc')
      .get();

    const montreuilInvitations = [];
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
        montreuilInvitations.push({
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

    console.log(`Montreuil invitations found: ${montreuilInvitations.length}`);

    // 5. Get connect docs for user related to Montreuil
    console.log('\n\n📬 CONNECT NOTIFICATIONS FOR MONTREUIL');
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

      if (message.toLowerCase().includes('montreuil')) {
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

    // 6. DETAILED GAME-BY-GAME ANALYSIS
    console.log('\n\n' + '='.repeat(80));
    console.log('GAME-BY-GAME ANALYSIS (Paris Time)');
    console.log('='.repeat(80));

    const dayNames = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const alertCreatedDate = montreuilAlertConfig ? montreuilAlertConfig.created : null;

    const results = {
      shouldHaveBeenInvited: [],
      wasInvited: [],
      missed: [],
      extraInvites: [], // Invites where criteria didn't match
    };

    for (const game of montreuilGames) {
      if (!game.date) continue;

      const parisDay = getParisWeekday(game.date);
      const { hour: parisHour, minute: parisMinute } = getParisHourMinute(game.date);
      const parisTimeStr = `${parisHour.toString().padStart(2, '0')}:${parisMinute.toString().padStart(2, '0')}`;

      // Check criteria
      const isAfterAlertCreated = alertCreatedDate ? game.date >= alertCreatedDate : false;
      const dayMatches = montreuilAlertConfig ? montreuilAlertConfig.weekdays.includes(parisDay) : false;
      const timeMatches = montreuilAlertConfig ? montreuilAlertConfig.times.includes(parisTimeStr) : false;

      const shouldHaveBeenInvited = isAfterAlertCreated && dayMatches && timeMatches && !game.isUserOrganizer;

      // Check actual invitations
      const wasInvited = montreuilInvitations.some(inv => inv.gameId === game.id);
      const invitationDoc = montreuilInvitations.find(inv => inv.gameId === game.id);
      const receivedConnect = montreuilConnects.some(c => c.gameId === game.id);
      const connectDoc = montreuilConnects.find(c => c.gameId === game.id);

      // Track results
      if (shouldHaveBeenInvited) results.shouldHaveBeenInvited.push(game.id);
      if (wasInvited) results.wasInvited.push(game.id);
      if (shouldHaveBeenInvited && !wasInvited) results.missed.push(game.id);
      if (!shouldHaveBeenInvited && wasInvited) results.extraInvites.push(game.id);

      // Display
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`GAME: ${game.id}`);
      console.log(`  📅 Date: ${formatParisTime(game.date)}`);
      console.log(`  📅 Day: ${dayNames[parisDay]} (${parisDay})`);
      console.log(`  ⏰ Time: ${parisTimeStr}`);
      console.log(`  📍 Centre: ${game.centre}`);
      console.log(`  🏷️ Status: ${game.status}`);
      console.log(`  🎮 Sport: ${game.sport}`);
      console.log(`  👥 Slots: ${game.slots}, Attendees: ${game.attendeesCount}`);
      console.log(`  👤 User is organizer: ${game.isUserOrganizer ? 'YES' : 'NO'}`);
      console.log(`  👤 User is attendee: ${game.isUserAttendee ? 'YES' : 'NO'}`);
      console.log('');
      console.log(`  📋 ALERT MATCHING:`);
      console.log(`     Alert created: ${alertCreatedDate ? formatParisTime(alertCreatedDate) : 'N/A'}`);
      console.log(`     Game after alert: ${isAfterAlertCreated ? '✅ YES' : '❌ NO'}`);
      console.log(`     Day matches (user: ${montreuilAlertConfig ? montreuilAlertConfig.weekdays.map(d=>dayNames[d]).join(',') : 'N/A'}): ${dayMatches ? '✅ YES' : '❌ NO'}`);
      console.log(`     Time matches: ${timeMatches ? '✅ YES' : '❌ NO'}`);
      console.log('');
      console.log(`  🎯 EXPECTED vs ACTUAL:`);
      console.log(`     SHOULD have been invited: ${shouldHaveBeenInvited ? '✅ YES' : '❌ NO'}`);
      console.log(`     WAS actually invited: ${wasInvited ? '✅ YES' : '❌ NO'}`);
      console.log(`     RECEIVED connect notification: ${receivedConnect ? '✅ YES' : '❌ NO'}`);

      if (invitationDoc) {
        console.log(`     📨 Invitation: ${invitationDoc.id}`);
        console.log(`        Created: ${formatParisTime(invitationDoc.created)}`);
        console.log(`        Source: ${invitationDoc.source}`);
        console.log(`        Status: ${invitationDoc.status}`);
      }

      if (connectDoc) {
        console.log(`     🔔 Connect: ${connectDoc.id}`);
        console.log(`        Datetime: ${formatParisTime(connectDoc.datetime)}`);
        console.log(`        Title: ${connectDoc.title}`);
      }

      // Highlight issues
      if (shouldHaveBeenInvited && !wasInvited) {
        console.log('');
        console.log(`  ⚠️  ISSUE: User should have been invited but was NOT!`);
      }
      if (!shouldHaveBeenInvited && wasInvited) {
        console.log('');
        console.log(`  ℹ️  NOTE: User was invited even though criteria didn't fully match`);
      }
    }

    // 7. FINAL SUMMARY
    console.log('\n\n' + '='.repeat(80));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📊 STATISTICS:`);
    console.log(`   Total 4PADEL Montreuil games since Nov 15: ${montreuilGames.length}`);
    console.log(`   Games matching user's criteria: ${results.shouldHaveBeenInvited.length}`);
    console.log(`   Games user was invited to: ${results.wasInvited.length}`);
    console.log(`   Montreuil invitations received: ${montreuilInvitations.length}`);
    console.log(`   Montreuil connect notifications: ${montreuilConnects.length}`);

    console.log(`\n✅ GAMES USER WAS INVITED TO:`);
    for (const gameId of results.wasInvited) {
      const game = montreuilGames.find(g => g.id === gameId);
      const inv = montreuilInvitations.find(i => i.gameId === gameId);
      console.log(`   - ${gameId}: ${formatParisTime(game?.date)} (source: ${inv?.source}, status: ${inv?.status})`);
    }

    console.log(`\n❌ GAMES USER SHOULD HAVE BEEN INVITED TO BUT WASN'T:`);
    if (results.missed.length === 0) {
      console.log(`   None - all expected invitations were sent!`);
    } else {
      for (const gameId of results.missed) {
        const game = montreuilGames.find(g => g.id === gameId);
        console.log(`   - ${gameId}: ${formatParisTime(game?.date)}`);
      }
    }

    console.log(`\nℹ️  EXTRA INVITES (sent even though criteria didn't match):`);
    if (results.extraInvites.length === 0) {
      console.log(`   None`);
    } else {
      for (const gameId of results.extraInvites) {
        const game = montreuilGames.find(g => g.id === gameId);
        const parisDay = getParisWeekday(game?.date);
        const { hour, minute } = getParisHourMinute(game?.date);
        const timeStr = `${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')}`;
        console.log(`   - ${gameId}: ${formatParisTime(game?.date)}`);
        console.log(`     Day: ${dayNames[parisDay]}, Time: ${timeStr}`);
        console.log(`     User's weekdays: ${montreuilAlertConfig?.weekdays.map(d=>dayNames[d]).join(', ')}`);
      }
    }

    // FCM tokens check
    console.log(`\n🔔 PUSH NOTIFICATION CAPABILITY:`);
    const userData = userDoc.exists ? userDoc.data() : null;
    const fcmTokens = userData?.fcm_tokens || [];
    if (fcmTokens.length === 0) {
      console.log(`   ⚠️  USER HAS 0 FCM TOKENS - Push notifications cannot be delivered!`);
      console.log(`   This means even though connect documents are created, the user won't receive push notifications.`);
    } else {
      console.log(`   ✅ User has ${fcmTokens.length} FCM token(s) - push notifications can be delivered`);
    }

  } catch (error) {
    console.error('Error during investigation:', error);
  } finally {
    process.exit();
  }
})();
