const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'krank-club'
});

const db = admin.firestore();

const ORGANIZER_IDS = [
  'psf3NmXEPwdCltHKJC7VuvJocrF3',
  'w5VZiCXqSxQ40riMnKYLO11xmeJ2'
];

const START_DATE = new Date('2025-11-01T00:00:00Z');
const END_DATE = new Date('2026-03-31T23:59:59Z');

function getPlayerCount(game) {
  // Try attendees array first, then currentPlayers, then current_players
  if (game.attendees && Array.isArray(game.attendees)) {
    return game.attendees.length;
  }
  return game.currentPlayers || game.current_players || 0;
}

async function analyze() {
  console.log('Fetching games for organizers:', ORGANIZER_IDS.join(', '));
  console.log(`Period: Nov 2025 - Mar 2026\n`);

  let allGames = [];
  for (const orgId of ORGANIZER_IDS) {
    const snapshot = await db.collection('games')
      .where('organizer', '==', orgId)
      .where('status', '==', 'played')
      .where('date', '>=', admin.firestore.Timestamp.fromDate(START_DATE))
      .where('date', '<=', admin.firestore.Timestamp.fromDate(END_DATE))
      .get();

    console.log(`Organizer ${orgId}: ${snapshot.size} played games`);
    snapshot.forEach(doc => {
      allGames.push({ id: doc.id, ...doc.data() });
    });
  }

  // Debug: check a sample game's fields
  if (allGames.length > 0) {
    const s = allGames[0];
    const playerCount = getPlayerCount(s);
    console.log(`\nSample game: attendees=${s.attendees ? s.attendees.length : 'N/A'}, currentPlayers=${s.currentPlayers}, current_players=${s.current_players}, max_players=${s.max_players || s.maxPlayers}, price=${s.price}`);
    console.log(`Using player count: ${playerCount}`);
  }

  console.log(`\nTotal played games: ${allGames.length}\n`);

  // Separate by centre
  const thiais = { soccer: [], padel: [] };
  const antibes = { soccer: [], padel: [] };
  const other = [];

  for (const game of allGames) {
    const centreName = (game.centre || '').toLowerCase();
    const sport = (game.sport || '').toLowerCase();
    const sportKey = (sport === 'football' || sport === 'soccer') ? 'soccer' : 'padel';

    if (centreName.includes('thiais')) {
      thiais[sportKey].push(game);
    } else if (centreName.includes('antibes')) {
      antibes[sportKey].push(game);
    } else {
      other.push(game);
    }
  }

  if (other.length > 0) {
    console.log('--- Games with unrecognized centre names ---');
    const centreNames = {};
    for (const g of other) {
      centreNames[g.centre] = (centreNames[g.centre] || 0) + 1;
    }
    for (const [name, count] of Object.entries(centreNames)) {
      console.log(`  "${name}": ${count} games`);
    }
    console.log('');
  }

  // Analyze each centre/sport combination
  for (const [centreName, data] of [['Stadium Thiais', thiais], ['Stadium Antibes', antibes]]) {
    console.log('='.repeat(60));
    console.log(`  ${centreName}`);
    console.log('='.repeat(60));

    let centreTotal = { games: 0, players: 0, revenue: 0, paymentRevenue: 0 };

    for (const [sportName, games] of [['Soccer (Football)', data.soccer], ['Padel', data.padel]]) {
      console.log(`\n  --- ${sportName} ---`);
      if (games.length === 0) {
        console.log('  No games found.\n');
        continue;
      }

      const monthly = {};
      let totalRevenue = 0;
      let totalPlayers = 0;
      let totalGames = 0;
      let gamesWithPrice = 0;
      let totalPaymentRevenue = 0;

      for (const game of games) {
        const date = game.date.toDate();
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthly[monthKey]) {
          monthly[monthKey] = { games: 0, players: 0, revenue: 0, paymentRevenue: 0 };
        }

        const players = getPlayerCount(game);
        const price = game.price || 0;
        const gameRevenue = price * players;

        monthly[monthKey].games++;
        monthly[monthKey].players += players;
        monthly[monthKey].revenue += gameRevenue;

        totalGames++;
        totalPlayers += players;
        totalRevenue += gameRevenue;
        if (price > 0) gamesWithPrice++;

        // Check for actual Stripe payments
        if (game.payments && game.payments.length > 0) {
          for (const payRef of game.payments) {
            try {
              const payDoc = await payRef.get();
              if (payDoc.exists) {
                const payData = payDoc.data();
                if (payData.status === 'captured') {
                  const amount = payData.amount || 0;
                  monthly[monthKey].paymentRevenue += amount;
                  totalPaymentRevenue += amount;
                }
              }
            } catch (e) { /* skip */ }
          }
        }
      }

      const sortedMonths = Object.keys(monthly).sort();
      const monthNames = {
        '2025-11': 'Nov 2025', '2025-12': 'Dec 2025',
        '2026-01': 'Jan 2026', '2026-02': 'Feb 2026', '2026-03': 'Mar 2026'
      };

      console.log('');
      console.log(`  ${'Month'.padEnd(12)} | ${'Games'.padStart(6)} | ${'Players'.padStart(8)} | ${'Rev (price x players)'.padStart(22)} | ${'Stripe captured'.padStart(16)}`);
      console.log(`  ${'-'.repeat(12)}-+-${'-'.repeat(6)}-+-${'-'.repeat(8)}-+-${'-'.repeat(22)}-+-${'-'.repeat(16)}`);

      for (const month of sortedMonths) {
        const m = monthly[month];
        const label = monthNames[month] || month;
        console.log(`  ${label.padEnd(12)} | ${String(m.games).padStart(6)} | ${String(m.players).padStart(8)} | ${m.revenue.toFixed(2).padStart(19)} EUR | ${m.paymentRevenue.toFixed(2).padStart(13)} EUR`);
      }

      console.log(`  ${'-'.repeat(12)}-+-${'-'.repeat(6)}-+-${'-'.repeat(8)}-+-${'-'.repeat(22)}-+-${'-'.repeat(16)}`);
      console.log(`  ${'TOTAL'.padEnd(12)} | ${String(totalGames).padStart(6)} | ${String(totalPlayers).padStart(8)} | ${totalRevenue.toFixed(2).padStart(19)} EUR | ${totalPaymentRevenue.toFixed(2).padStart(13)} EUR`);

      console.log(`\n  Avg players/game: ${totalGames > 0 ? (totalPlayers / totalGames).toFixed(1) : 0}`);
      console.log(`  Avg fill rate: ${totalGames > 0 ? ((totalPlayers / games.reduce((s, g) => s + (g.max_players || g.maxPlayers || 0), 0)) * 100).toFixed(1) : 0}%`);
      console.log(`  Games with price > 0: ${gamesWithPrice}/${totalGames}`);
      if (gamesWithPrice > 0) {
        const avgPrice = games.filter(g => g.price > 0).reduce((s, g) => s + g.price, 0) / gamesWithPrice;
        console.log(`  Avg price/spot: ${avgPrice.toFixed(2)} EUR`);
      }

      const paymentTypes = {};
      for (const g of games) {
        const pt = g.payment_type || 'unknown';
        paymentTypes[pt] = (paymentTypes[pt] || 0) + 1;
      }
      console.log(`  Payment types: ${JSON.stringify(paymentTypes)}`);

      centreTotal.games += totalGames;
      centreTotal.players += totalPlayers;
      centreTotal.revenue += totalRevenue;
      centreTotal.paymentRevenue += totalPaymentRevenue;
    }

    console.log(`\n  >>> ${centreName} GRAND TOTAL: ${centreTotal.games} games | ${centreTotal.players} players | ${centreTotal.revenue.toFixed(2)} EUR (estimated) | ${centreTotal.paymentRevenue.toFixed(2)} EUR (Stripe)\n`);
  }

  process.exit(0);
}

analyze().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
