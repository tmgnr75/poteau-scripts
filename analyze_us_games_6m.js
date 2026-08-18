const fs = require('fs');

const files = fs.readdirSync('exports').filter(f => f.startsWith('us_games_6m')).sort();
const DATA = 'exports/' + files[files.length - 1];
const games = JSON.parse(fs.readFileSync(DATA, 'utf-8'));

// ---- helpers ---------------------------------------------------------------
function localParts(iso, tz) {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz || 'America/Los_Angeles',
        year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(d);
    const get = t => p.find(x => x.type === t)?.value;
    return { ymd: `${get('year')}-${get('month')}-${get('day')}`, month: `${get('year')}-${get('month')}`, weekday: get('weekday') };
}
// ISO week key (year-Www) from a YYYY-MM-DD in local time
function isoWeek(ymd) {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
    return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
function region(g) {
    if ((g.time_zone || '').includes('New_York')) return 'New York / Miami (East)';
    if ((g.time_zone || '').includes('Los_Angeles')) return 'Los Angeles (West)';
    return 'Other US';
}
function venue(g) {
    const a = (g.address || g.centre || 'Unknown').trim();
    return a;
}
const pct = (n, t) => t ? ((n / t) * 100).toFixed(1) : '0.0';
const bar = (v, max, w = 30) => '█'.repeat(Math.round((v / max) * w));

// enrich
games.forEach(g => {
    const lp = localParts(g.date, g.time_zone);
    g._ymd = lp.ymd; g._month = lp.month; g._week = isoWeek(lp.ymd); g._wd = lp.weekday;
    g._region = region(g);
    g._venue = venue(g);
    g._players = g.attendee_count + (g.outsider_count || 0);
});

const uniq = arr => new Set(arr).size;
const allPlayers = new Set();
games.forEach(g => (g.attendee_ids || []).forEach(id => allPlayers.add(id)));

console.log('='.repeat(72));
console.log('  RAPPORT — GAMES JOUÉS AUX ÉTATS-UNIS (United States) — 6 DERNIERS MOIS');
console.log(`  ${games[0]._ymd} → ${games[games.length - 1]._ymd}`);
console.log('='.repeat(72));
console.log(`  Total games joués (US)        : ${games.length}`);
console.log(`  Joueurs uniques (app) au total: ${allPlayers.size}`);
const totPlayerSlots = games.reduce((s, g) => s + g._players, 0);
console.log(`  Présences cumulées (joueurs+outsiders): ${totPlayerSlots}`);
console.log(`  Moyenne joueurs / game        : ${(totPlayerSlots / games.length).toFixed(1)}`);
console.log(`  Outsiders (invités hors app)  : ${games.reduce((s, g) => s + (g.outsider_count || 0), 0)}`);

// ---- by region -------------------------------------------------------------
console.log('\n' + '─'.repeat(72));
console.log('  RÉPARTITION PAR RÉGION');
console.log('─'.repeat(72));
const byRegion = {};
games.forEach(g => {
    byRegion[g._region] = byRegion[g._region] || { games: 0, players: new Set(), presences: 0 };
    byRegion[g._region].games++;
    byRegion[g._region].presences += g._players;
    (g.attendee_ids || []).forEach(id => byRegion[g._region].players.add(id));
});
Object.entries(byRegion).sort((a, b) => b[1].games - a[1].games).forEach(([r, v]) => {
    console.log(`  ${r.padEnd(28)} ${String(v.games).padStart(3)} games | ${String(v.players.size).padStart(3)} joueurs uniques | ${v.presences} présences`);
});

// ---- by venue --------------------------------------------------------------
console.log('\n' + '─'.repeat(72));
console.log('  TOP LIEUX (venues)');
console.log('─'.repeat(72));
const byVenue = {};
games.forEach(g => {
    byVenue[g._venue] = byVenue[g._venue] || { games: 0, players: new Set(), presences: 0, region: g._region };
    byVenue[g._venue].games++;
    byVenue[g._venue].presences += g._players;
    (g.attendee_ids || []).forEach(id => byVenue[g._venue].players.add(id));
});
Object.entries(byVenue).sort((a, b) => b[1].games - a[1].games).forEach(([v, d]) => {
    console.log(`  ${String(d.games).padStart(3)} games | ${String(d.players.size).padStart(3)} joueurs | ${v.slice(0, 45).padEnd(45)} [${d.region.split(' ')[0]}]`);
});

// ---- by month --------------------------------------------------------------
console.log('\n' + '─'.repeat(72));
console.log('  ÉVOLUTION PAR MOIS');
console.log('─'.repeat(72));
const byMonth = {};
games.forEach(g => {
    byMonth[g._month] = byMonth[g._month] || { games: 0, players: new Set(), presences: 0 };
    byMonth[g._month].games++;
    byMonth[g._month].presences += g._players;
    (g.attendee_ids || []).forEach(id => byMonth[g._month].players.add(id));
});
const months = Object.keys(byMonth).sort();
const maxM = Math.max(...months.map(m => byMonth[m].games));
console.log('  Mois     Games  Joueurs  Présences');
months.forEach(m => {
    const v = byMonth[m];
    console.log(`  ${m}  ${String(v.games).padStart(4)}   ${String(v.players.size).padStart(4)}    ${String(v.presences).padStart(5)}   ${bar(v.games, maxM)}`);
});

// ---- by week ---------------------------------------------------------------
console.log('\n' + '─'.repeat(72));
console.log('  ÉVOLUTION SEMAINE PAR SEMAINE');
console.log('─'.repeat(72));
const byWeek = {};
games.forEach(g => {
    byWeek[g._week] = byWeek[g._week] || { games: 0, players: new Set(), presences: 0, start: g._ymd };
    byWeek[g._week].games++;
    byWeek[g._week].presences += g._players;
    if (g._ymd < byWeek[g._week].start) byWeek[g._week].start = g._ymd;
    (g.attendee_ids || []).forEach(id => byWeek[g._week].players.add(id));
});
const weeks = Object.keys(byWeek).sort();
const maxW = Math.max(...weeks.map(w => byWeek[w].games));
console.log('  Semaine     (début)     Games  Joueurs  Présences');
weeks.forEach(w => {
    const v = byWeek[w];
    console.log(`  ${w}  ${v.start}  ${String(v.games).padStart(4)}   ${String(v.players.size).padStart(4)}    ${String(v.presences).padStart(5)}  ${bar(v.games, maxW, 20)}`);
});

// ---- ZOOM: last 6 weeks (World Cup window) ---------------------------------
console.log('\n' + '═'.repeat(72));
console.log('  🏆 ZOOM DÉTAILLÉ — 6 DERNIÈRES SEMAINES (fenêtre Coupe du Monde)');
console.log('═'.repeat(72));
const recentWeeks = weeks.slice(-6);
const recentGames = games.filter(g => recentWeeks.includes(g._week));
const recentPlayers = new Set();
recentGames.forEach(g => (g.attendee_ids || []).forEach(id => recentPlayers.add(id)));
console.log(`  Période : ${recentGames[0]._ymd} → ${recentGames[recentGames.length - 1]._ymd}`);
console.log(`  Games : ${recentGames.length} | Joueurs uniques : ${recentPlayers.size} | Présences : ${recentGames.reduce((s, g) => s + g._players, 0)}`);

// new players appearing in the recent window (first-seen after the earlier window)
const earlierPlayers = new Set();
games.filter(g => !recentWeeks.includes(g._week)).forEach(g => (g.attendee_ids || []).forEach(id => earlierPlayers.add(id)));
const newInRecent = [...recentPlayers].filter(id => !earlierPlayers.has(id));
console.log(`  Nouveaux joueurs (jamais vus avant cette fenêtre) : ${newInRecent.length}`);

console.log('\n  Détail par game (6 dernières semaines) :');
console.log('  Date        Jour  Région  Lieu                              Joueurs (app+out)');
recentGames.forEach(g => {
    console.log(`  ${g._ymd}  ${g._wd}   ${g._region.split(' ')[0].padEnd(6)} ${(g._venue).slice(0, 32).padEnd(32)} ${String(g._players).padStart(2)} (${g.attendee_count}+${g.outsider_count || 0})`);
});

console.log('\n' + '='.repeat(72));
