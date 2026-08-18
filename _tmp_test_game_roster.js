// What the two VSD39 Dole test games look like as a roster, so we know what
// the simulator should be showing.
const admin = require('firebase-admin');
admin.initializeApp({
  credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
  projectId: 'krank-club',
});
const db = admin.firestore();

const IDS = ['eO11iWol9aJK9dULPIBX', 'VDbMga4BNc2Hv8IboZye'];

(async () => {
  for (const id of IDS) {
    const d = await db.collection('games').doc(id).get();
    if (!d.exists) { console.log(id + ': MISSING'); continue; }
    const teams = d.get('teams') || [];
    console.log('=== ' + id + ' ===');
    console.log('status:', d.get('status'), '| maxPlayers:', d.get('max_players'),
      '| poteau_live:', d.get('poteau_live'), '| date:',
      d.get('date') ? d.get('date').toDate().toISOString() : '-');
    for (const side of ['team_a', 'team_b']) {
      const mine = teams.filter(s => s && s.team_side === side);
      const open = mine.filter(s => s.status === 'open').length;
      const guests = mine.filter(s => s.plus_one === true).length;
      const players = mine.filter(s => s.status !== 'open' && !s.plus_one).length;
      console.log('  ' + side + ': ' + mine.length + ' spots -> ' +
        players + ' player(s), ' + guests + ' guest(s), ' + open + ' open');
    }
    console.log('  tiles after grouping: see below');
    // Mirror groupTeamRoster so we can predict the screen.
    for (const side of ['team_a', 'team_b']) {
      const mine = teams.filter(s => s && s.team_side === side);
      const hosts = new Set();
      const guestsBy = {};
      let tiles = 0;
      for (const s of mine) {
        if (s.status === 'open') { tiles++; continue; }
        if (!s.user_id) { tiles++; continue; }
        if (s.plus_one) { guestsBy[s.user_id] = (guestsBy[s.user_id] || 0) + 1; continue; }
        if (!hosts.has(s.user_id)) { hosts.add(s.user_id); tiles++; }
      }
      for (const uid of Object.keys(guestsBy)) {
        if (!hosts.has(uid)) { hosts.add(uid); tiles++; }
      }
      const detail = Object.keys(guestsBy).map(u => '+' + guestsBy[u]).join(', ');
      console.log('    ' + side + ': ' + tiles + ' tiles' + (detail ? ' (strips: ' + detail + ')' : ''));
    }
    console.log('');
  }
  process.exit(0);
})();
