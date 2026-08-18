const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'exports', 'padel_games_export.json');
const games = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ===========================
// HELPERS
// ===========================

function parseDate(dateStr) {
    if (!dateStr) return null;
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (match) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]), parseInt(match[4]), parseInt(match[5]));
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatDateShort(d) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
}

function getMonday(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    dt.setDate(diff);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

function getWeekKey(d) {
    const monday = getMonday(d);
    return monday.toISOString().split('T')[0];
}

function getWeekLabel(mondayStr) {
    const monday = new Date(mondayStr);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return `${formatDateShort(monday)} → ${formatDateShort(sunday)}`;
}

function getDayName(dayIdx) {
    return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][dayIdx];
}

// ===========================
// PARSE ALL GAMES
// ===========================

const parsedGames = games.map(g => {
    const gameDate = parseDate(g.date);
    const createdDate = parseDate(g.created_on);
    const attendeeUids = g.attendees_uids ? g.attendees_uids.split(', ').filter(Boolean) : [];
    const uniqueAttendees = [...new Set(attendeeUids)];

    return {
        ...g,
        gameDate,
        createdDate,
        attendeeUids,
        uniqueAttendees,
        weekKey: gameDate ? getWeekKey(gameDate) : null,
    };
}).filter(g => g.gameDate); // Only games with valid dates

// Only analyze games up to today (ignore future published games for some metrics)
const now = new Date();
const pastGames = parsedGames.filter(g => g.gameDate <= now);
const futureGames = parsedGames.filter(g => g.gameDate > now);

console.log(`Parsed ${parsedGames.length} games (${pastGames.length} past, ${futureGames.length} future)\n`);

// ===========================
// 4.1 - VUE D'ENSEMBLE
// ===========================

const firstGame = parsedGames.reduce((min, g) => !min || g.gameDate < min ? g.gameDate : min, null);
const lastGame = parsedGames.reduce((max, g) => !max || g.gameDate > max ? g.gameDate : max, null);

const statusCounts = {};
parsedGames.forEach(g => {
    statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
});

const typeCounts = {};
parsedGames.forEach(g => {
    typeCounts[g.type] = (typeCounts[g.type] || 0) + 1;
});

const allOrganizers = new Set(parsedGames.map(g => g.organizer_uid).filter(Boolean));
const allPlayers = new Set();
parsedGames.forEach(g => g.uniqueAttendees.forEach(uid => allPlayers.add(uid)));

// Global fill rate (only past games that are played or canceled — not future published)
const fillableGames = pastGames.filter(g => g.status === 'played' || g.status === 'canceled' || g.status === 'published');
const totalAttendees = fillableGames.reduce((sum, g) => sum + (g.attendees_count || 0), 0);
const totalMaxPlayers = fillableGames.reduce((sum, g) => sum + (g.max_players || 0), 0);
const globalFillRate = totalMaxPlayers > 0 ? (totalAttendees / totalMaxPlayers * 100).toFixed(1) : 'N/A';

// ===========================
// 4.2 - WEEK BY WEEK
// ===========================

const weeklyData = new Map();
const allPlayersEverSeen = new Set();

// Sort games by date
const sortedGames = [...parsedGames].sort((a, b) => a.gameDate - b.gameDate);

for (const game of sortedGames) {
    const weekKey = game.weekKey;
    if (!weekKey) continue;

    if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
            created: 0,
            played: 0,
            canceled: 0,
            published: 0,
            hidden: 0,
            uniquePlayers: new Set(),
            newPlayers: new Set(),
            organizers: new Set(),
            totalAttendees: 0,
            totalMaxPlayers: 0,
            centres: new Set(),
        });
    }

    const week = weeklyData.get(weekKey);
    week.created++;

    switch (game.status) {
        case 'played': week.played++; break;
        case 'canceled': week.canceled++; break;
        case 'published': week.published++; break;
        case 'hidden': week.hidden++; break;
    }

    game.uniqueAttendees.forEach(uid => {
        week.uniquePlayers.add(uid);
        if (!allPlayersEverSeen.has(uid)) {
            week.newPlayers.add(uid);
            allPlayersEverSeen.add(uid);
        }
    });

    if (game.organizer_uid) week.organizers.add(game.organizer_uid);
    week.totalAttendees += game.attendees_count || 0;
    week.totalMaxPlayers += game.max_players || 0;

    if (game.type === 'pro' && game.centre) week.centres.add(game.centre);
}

// ===========================
// 4.3 - ORGANIZERS / CENTRES
// ===========================

const orgAnalysis = new Map();
for (const game of parsedGames) {
    const uid = game.organizer_uid;
    if (!uid) continue;

    if (!orgAnalysis.has(uid)) {
        orgAnalysis.set(uid, {
            uid,
            name: game.organizer_name,
            type: game.organizer_type || game.type,
            centre_name: game.organizer_centre_name || game.centre || '',
            games: [],
            weeklyGames: new Map(),
            dayDistrib: new Array(7).fill(0),
            hourDistrib: {},
            loyalPlayers: new Map(), // uid -> count
        });
    }

    const org = orgAnalysis.get(uid);
    org.games.push(game);

    if (game.weekKey) {
        org.weeklyGames.set(game.weekKey, (org.weeklyGames.get(game.weekKey) || 0) + 1);
    }

    if (game.gameDate) {
        org.dayDistrib[game.gameDate.getDay()]++;
        const hour = game.gameDate.getHours();
        const hourKey = `${String(hour).padStart(2, '0')}:00`;
        org.hourDistrib[hourKey] = (org.hourDistrib[hourKey] || 0) + 1;
    }

    game.uniqueAttendees.forEach(uid => {
        if (uid !== game.organizer_uid) {
            org.loyalPlayers.set(uid, (org.loyalPlayers.get(uid) || 0) + 1);
        }
    });
}

// ===========================
// 4.4 - PLAYER ANALYSIS
// ===========================

const playerAnalysis = new Map();
for (const game of parsedGames) {
    for (const uid of game.uniqueAttendees) {
        if (!playerAnalysis.has(uid)) {
            playerAnalysis.set(uid, {
                uid,
                games: [],
                firstGame: null,
                lastGame: null,
                weeks: new Set(),
            });
        }

        const p = playerAnalysis.get(uid);
        p.games.push(game);
        if (!p.firstGame || game.gameDate < p.firstGame) p.firstGame = game.gameDate;
        if (!p.lastGame || game.gameDate > p.lastGame) p.lastGame = game.gameDate;
        if (game.weekKey) p.weeks.add(game.weekKey);
    }
}

// ===========================
// 4.5 - CENTRE FOCUS
// ===========================

const centreAnalysis = new Map();
for (const game of parsedGames) {
    if (game.type !== 'pro') continue;

    const centreKey = game.organizer_uid;
    const centreName = game.centre || game.organizer_name;

    if (!centreAnalysis.has(centreKey)) {
        centreAnalysis.set(centreKey, {
            id: centreKey,
            name: centreName,
            address: game.address || '',
            games: [],
            weeklyGames: new Map(),
            hourSlots: {},
            playersBrought: new Set(), // players who are NOT the organizer
        });
    }

    const c = centreAnalysis.get(centreKey);
    c.games.push(game);

    if (game.weekKey) {
        c.weeklyGames.set(game.weekKey, (c.weeklyGames.get(game.weekKey) || 0) + 1);
    }

    if (game.gameDate) {
        const hourKey = `${String(game.gameDate.getHours()).padStart(2, '0')}:00`;
        if (!c.hourSlots[hourKey]) {
            c.hourSlots[hourKey] = { total: 0, attendees: 0, maxPlayers: 0 };
        }
        c.hourSlots[hourKey].total++;
        c.hourSlots[hourKey].attendees += game.attendees_count || 0;
        c.hourSlots[hourKey].maxPlayers += game.max_players || 0;
    }

    game.uniqueAttendees.forEach(uid => {
        if (uid !== game.organizer_uid) {
            c.playersBrought.add(uid);
        }
    });
}

// ===========================
// GENERATE MARKDOWN REPORT
// ===========================

let md = '';

md += '# Analyse Padel — Poteau\n\n';
md += `*Rapport généré le ${formatDate(now)}*\n\n`;
md += '---\n\n';

// 4.1 - Vue d'ensemble
md += '## Vue d\'ensemble\n\n';
md += `| Métrique | Valeur |\n`;
md += `|----------|--------|\n`;
md += `| **Date de lancement** | ${formatDate(firstGame)} |\n`;
md += `| **Dernier game** | ${formatDate(lastGame)} |\n`;
md += `| **Durée d'activité** | ${Math.ceil((lastGame - firstGame) / (1000 * 60 * 60 * 24))} jours |\n`;
md += `| **Nombre total de games** | **${parsedGames.length}** |\n`;
md += `| — Games played | ${statusCounts['played'] || 0} |\n`;
md += `| — Games canceled | ${statusCounts['canceled'] || 0} |\n`;
md += `| — Games hidden | ${statusCounts['hidden'] || 0} |\n`;
md += `| — Games published (passés + à venir) | ${statusCounts['published'] || 0} |\n`;
md += `| **Games type "pro" (centres)** | ${typeCounts['pro'] || 0} |\n`;
md += `| **Games type "captain" (joueurs)** | ${typeCounts['captain'] || 0} |\n`;
md += `| **Organisateurs uniques** | **${allOrganizers.size}** |\n`;
md += `| **Joueurs uniques** (ayant rejoint au moins 1 game) | **${allPlayers.size}** |\n`;
md += `| **Taux de remplissage global** | **${globalFillRate}%** |\n`;
md += `| Total attendees (toutes inscriptions) | ${totalAttendees} |\n`;
md += `| Total places disponibles | ${totalMaxPlayers} |\n\n`;

// 4.2 - Semaine par semaine
md += '## Analyse semaine par semaine\n\n';
md += '| Semaine | Games créés | Joués | Annulés | Publiés | Joueurs uniques | Nouveaux joueurs | Taux remplissage | Organisateurs actifs | Centres actifs |\n';
md += '|---------|------------|-------|---------|---------|-----------------|-----------------|------------------|---------------------|---------------|\n';

const sortedWeeks = [...weeklyData.entries()].sort((a, b) => a[0].localeCompare(b[0]));

for (const [weekKey, week] of sortedWeeks) {
    const label = getWeekLabel(weekKey);
    const fillRate = week.totalMaxPlayers > 0
        ? (week.totalAttendees / week.totalMaxPlayers * 100).toFixed(0) + '%'
        : '-';

    md += `| ${label} | ${week.created} | ${week.played} | ${week.canceled + week.hidden} | ${week.published} | ${week.uniquePlayers.size} | ${week.newPlayers.size} | ${fillRate} | ${week.organizers.size} | ${week.centres.size > 0 ? week.centres.size : '-'} |\n`;
}

md += '\n';

// Weekly commentary
md += '### Commentaires semaine par semaine\n\n';

let prevWeekGames = 0;
const newCentresTracker = new Set();
for (const [weekKey, week] of sortedWeeks) {
    const label = getWeekLabel(weekKey);
    const comments = [];

    if (week.created >= prevWeekGames * 2 && prevWeekGames > 0) {
        comments.push(`Pic d'activité : ${week.created} games créés (x${(week.created / prevWeekGames).toFixed(1)} vs semaine précédente)`);
    }
    if (week.created <= prevWeekGames / 2 && prevWeekGames > 5) {
        comments.push(`Creux d'activité : seulement ${week.created} games (÷${(prevWeekGames / week.created).toFixed(1)} vs semaine précédente)`);
    }

    for (const centre of week.centres) {
        if (!newCentresTracker.has(centre)) {
            newCentresTracker.add(centre);
            comments.push(`Arrivée du centre partenaire : **${centre}**`);
        }
    }

    const fillRate = week.totalMaxPlayers > 0
        ? week.totalAttendees / week.totalMaxPlayers * 100
        : 0;
    if (fillRate > 50) {
        comments.push(`Bon taux de remplissage : ${fillRate.toFixed(0)}%`);
    }

    if (week.newPlayers.size >= 5) {
        comments.push(`${week.newPlayers.size} nouveaux joueurs cette semaine`);
    }

    if (comments.length > 0) {
        md += `**${label}** :\n`;
        comments.forEach(c => md += `- ${c}\n`);
        md += '\n';
    }

    prevWeekGames = week.created;
}

// 4.3 - Analyse par organisateur
md += '## Analyse par organisateur\n\n';

const topOrganizers = [...orgAnalysis.values()].sort((a, b) => b.games.length - a.games.length);

for (const org of topOrganizers.slice(0, 15)) {
    const totalGames = org.games.length;
    const playedGames = org.games.filter(g => g.status === 'played').length;
    const canceledGames = org.games.filter(g => g.status === 'canceled' || g.status === 'hidden').length;
    const totalAtt = org.games.reduce((s, g) => s + (g.attendees_count || 0), 0);
    const totalMax = org.games.reduce((s, g) => s + (g.max_players || 0), 0);
    const fillRate = totalMax > 0 ? (totalAtt / totalMax * 100).toFixed(1) : 'N/A';

    const loyalCount = [...org.loyalPlayers.values()].filter(c => c >= 2).length;

    const firstGameDate = org.games.reduce((min, g) => !min || g.gameDate < min ? g.gameDate : min, null);
    const lastGameDate = org.games.reduce((max, g) => !max || g.gameDate > max ? g.gameDate : max, null);

    md += `### ${org.name} (${org.type === 'pro' ? 'Centre partenaire' : 'Joueur'})\n\n`;
    md += `| Métrique | Valeur |\n`;
    md += `|----------|--------|\n`;
    md += `| Games créés | **${totalGames}** |\n`;
    md += `| Games joués | ${playedGames} |\n`;
    md += `| Games annulés | ${canceledGames} |\n`;
    md += `| Taux de remplissage | ${fillRate}% |\n`;
    md += `| Joueurs fidèles (2+ games) | ${loyalCount} |\n`;
    md += `| Premier game | ${formatDate(firstGameDate)} |\n`;
    md += `| Dernier game | ${formatDate(lastGameDate)} |\n\n`;

    // Day distribution
    const daysWithGames = org.dayDistrib.map((count, i) => ({ day: getDayName(i), count })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
    if (daysWithGames.length > 0) {
        md += `**Jours préférés :** ${daysWithGames.map(d => `${d.day} (${d.count})`).join(', ')}\n\n`;
    }

    // Hour distribution
    const hoursWithGames = Object.entries(org.hourDistrib).sort((a, b) => b[1] - a[1]);
    if (hoursWithGames.length > 0) {
        md += `**Heures préférées :** ${hoursWithGames.slice(0, 5).map(([h, c]) => `${h} (${c})`).join(', ')}\n\n`;
    }

    // Weekly evolution (compact)
    if (org.weeklyGames.size > 3) {
        const weekEntries = [...org.weeklyGames.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        md += `**Évolution hebdomadaire :** `;
        md += weekEntries.map(([wk, cnt]) => `${getWeekLabel(wk)}: ${cnt}`).join(' | ');
        md += '\n\n';
    }
}

// 4.4 - Player analysis
md += '## Analyse des joueurs\n\n';

const playerGameCounts = [...playerAnalysis.values()].map(p => p.games.length);
const oneGame = playerGameCounts.filter(c => c === 1).length;
const twoThreeGames = playerGameCounts.filter(c => c >= 2 && c <= 3).length;
const fourPlusGames = playerGameCounts.filter(c => c >= 4).length;

md += '### Distribution du nombre de games par joueur\n\n';
md += `| Tranche | Nombre de joueurs | % |\n`;
md += `|---------|-------------------|---|\n`;
md += `| 1 game | ${oneGame} | ${(oneGame / playerAnalysis.size * 100).toFixed(1)}% |\n`;
md += `| 2-3 games | ${twoThreeGames} | ${(twoThreeGames / playerAnalysis.size * 100).toFixed(1)}% |\n`;
md += `| 4+ games | ${fourPlusGames} | ${(fourPlusGames / playerAnalysis.size * 100).toFixed(1)}% |\n\n`;

// Retention
md += '### Rétention\n\n';
const weekSortedPlayers = [...playerAnalysis.values()]
    .filter(p => p.weeks.size >= 2)
    .sort((a, b) => b.weeks.size - a.weeks.size);

md += `- **Joueurs revenant sur 2+ semaines** : ${weekSortedPlayers.length} (${(weekSortedPlayers.length / playerAnalysis.size * 100).toFixed(1)}%)\n`;

const threeWeekPlus = weekSortedPlayers.filter(p => p.weeks.size >= 3).length;
md += `- **Joueurs revenant sur 3+ semaines** : ${threeWeekPlus}\n`;

const fiveWeekPlus = weekSortedPlayers.filter(p => p.weeks.size >= 5).length;
md += `- **Joueurs revenant sur 5+ semaines** : ${fiveWeekPlus}\n\n`;

// Time to second game
md += '### Délai entre premier et deuxième game\n\n';
const delaysToSecondGame = [];
for (const p of playerAnalysis.values()) {
    if (p.games.length >= 2) {
        const sortedDates = p.games.map(g => g.gameDate).sort((a, b) => a - b);
        const delay = (sortedDates[1] - sortedDates[0]) / (1000 * 60 * 60 * 24);
        delaysToSecondGame.push(delay);
    }
}

if (delaysToSecondGame.length > 0) {
    delaysToSecondGame.sort((a, b) => a - b);
    const avgDelay = delaysToSecondGame.reduce((s, d) => s + d, 0) / delaysToSecondGame.length;
    const medianDelay = delaysToSecondGame[Math.floor(delaysToSecondGame.length / 2)];
    md += `- **Joueurs ayant joué 2+ games** : ${delaysToSecondGame.length}\n`;
    md += `- **Délai moyen** : ${avgDelay.toFixed(1)} jours\n`;
    md += `- **Délai médian** : ${medianDelay.toFixed(1)} jours\n\n`;
} else {
    md += `- Pas assez de données pour calculer le délai\n\n`;
}

// Top 10 players
md += '### Top 10 joueurs les plus actifs\n\n';
md += `| # | Joueur | Games rejoints | Semaines actives | Premier game | Dernier game |\n`;
md += `|---|--------|---------------|-----------------|--------------|-------------|\n`;

const topPlayers = [...playerAnalysis.values()]
    .sort((a, b) => b.games.length - a.games.length)
    .slice(0, 10);

// Get display names from the games data
for (let i = 0; i < topPlayers.length; i++) {
    const p = topPlayers[i];
    // Find display name from attendees_list in any game
    let displayName = p.uid;
    for (const game of p.games) {
        if (game.attendees_list) {
            const regex = new RegExp(`([^,]+?)\\s*\\(`);
            const entries = game.attendees_list.split(', ');
            for (const entry of entries) {
                // Check if this entry's UID matches
                if (game.attendees_uids.includes(p.uid)) {
                    const nameMatch = entry.match(/^(.+?)\s*\(/);
                    if (nameMatch) {
                        displayName = nameMatch[1].trim();
                        break;
                    }
                }
            }
        }
        if (displayName !== p.uid) break;

        // Try organizer name
        if (game.organizer_uid === p.uid) {
            displayName = game.organizer_name;
            break;
        }
    }

    md += `| ${i + 1} | ${displayName} | **${p.games.length}** | ${p.weeks.size} | ${formatDate(p.firstGame)} | ${formatDate(p.lastGame)} |\n`;
}

md += '\n';

// 4.5 - Focus centres partenaires
md += '## Focus centres partenaires\n\n';

for (const centre of centreAnalysis.values()) {
    const totalGames = centre.games.length;
    const playedGames = centre.games.filter(g => g.status === 'played').length;
    const canceledGames = centre.games.filter(g => g.status === 'canceled' || g.status === 'hidden').length;
    const publishedGames = centre.games.filter(g => g.status === 'published').length;
    const totalAtt = centre.games.reduce((s, g) => s + (g.attendees_count || 0), 0);
    const totalMax = centre.games.reduce((s, g) => s + (g.max_players || 0), 0);
    const fillRate = totalMax > 0 ? (totalAtt / totalMax * 100).toFixed(1) : 'N/A';

    const firstGameDate = centre.games.reduce((min, g) => !min || g.gameDate < min ? g.gameDate : min, null);
    const lastGameDate = centre.games.reduce((max, g) => !max || g.gameDate > max ? g.gameDate : max, null);

    md += `### ${centre.name}\n\n`;
    md += `**Adresse :** ${centre.address || 'N/A'}\n\n`;
    md += `| Métrique | Valeur |\n`;
    md += `|----------|--------|\n`;
    md += `| Games créés | **${totalGames}** |\n`;
    md += `| Games joués | ${playedGames} |\n`;
    md += `| Games annulés | ${canceledGames} |\n`;
    md += `| Games publiés (à venir) | ${publishedGames} |\n`;
    md += `| Taux de remplissage global | **${fillRate}%** |\n`;
    md += `| Joueurs Poteau amenés | **${centre.playersBrought.size}** |\n`;
    md += `| Total inscriptions joueurs | ${totalAtt} |\n`;
    md += `| Premier game | ${formatDate(firstGameDate)} |\n`;
    md += `| Dernier game | ${formatDate(lastGameDate)} |\n\n`;

    // Hourly slots
    md += '**Créneaux horaires et taux de remplissage :**\n\n';
    md += '| Heure | Games | Inscriptions | Places dispo | Taux remplissage |\n';
    md += '|-------|-------|-------------|-------------|------------------|\n';

    const sortedSlots = Object.entries(centre.hourSlots).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [hour, slot] of sortedSlots) {
        const slotFill = slot.maxPlayers > 0 ? (slot.attendees / slot.maxPlayers * 100).toFixed(0) + '%' : '-';
        md += `| ${hour} | ${slot.total} | ${slot.attendees} | ${slot.maxPlayers} | ${slotFill} |\n`;
    }
    md += '\n';

    // Weekly timeline
    if (centre.weeklyGames.size > 0) {
        md += '**Timeline hebdomadaire :**\n\n';
        md += '| Semaine | Games créés |\n';
        md += '|---------|------------|\n';
        const weekEntries = [...centre.weeklyGames.entries()].sort((a, b) => a[0].localeCompare(b[0]));
        for (const [wk, cnt] of weekEntries) {
            md += `| ${getWeekLabel(wk)} | ${cnt} |\n`;
        }
        md += '\n';
    }
}

// Comparison
md += '### Comparaison entre centres\n\n';
md += '| Centre | Games | Joués | Annulés | Taux remplissage | Joueurs amenés | Période |\n';
md += '|--------|-------|-------|---------|------------------|----------------|--------|\n';

const sortedCentres = [...centreAnalysis.values()].sort((a, b) => b.games.length - a.games.length);
for (const c of sortedCentres) {
    const totalAtt = c.games.reduce((s, g) => s + (g.attendees_count || 0), 0);
    const totalMax = c.games.reduce((s, g) => s + (g.max_players || 0), 0);
    const fillRate = totalMax > 0 ? (totalAtt / totalMax * 100).toFixed(0) + '%' : '-';
    const first = c.games.reduce((min, g) => !min || g.gameDate < min ? g.gameDate : min, null);
    const last = c.games.reduce((max, g) => !max || g.gameDate > max ? g.gameDate : max, null);
    const played = c.games.filter(g => g.status === 'played').length;
    const canceled = c.games.filter(g => g.status === 'canceled' || g.status === 'hidden').length;

    md += `| ${c.name} | **${c.games.length}** | ${played} | ${canceled} | ${fillRate} | ${c.playersBrought.size} | ${formatDate(first)} → ${formatDate(last)} |\n`;
}

md += '\n---\n\n';
md += `*Données exportées de Firestore le ${formatDate(now)}. Base : ${parsedGames.length} games padel.*\n`;

// ===========================
// WRITE FILE
// ===========================

const outputPath = path.join(__dirname, 'exports', 'padel_analysis.md');
fs.writeFileSync(outputPath, md, { encoding: 'utf8' });
console.log(`\nReport written to ${outputPath}`);
console.log(`Report length: ${md.length} characters, ${md.split('\n').length} lines`);

// Quick console summary
console.log('\n=== KEY FIGURES ===');
console.log(`Total padel games: ${parsedGames.length}`);
console.log(`Date range: ${formatDate(firstGame)} → ${formatDate(lastGame)}`);
console.log(`Statuses: played=${statusCounts['played']||0}, canceled=${statusCounts['canceled']||0}, published=${statusCounts['published']||0}, hidden=${statusCounts['hidden']||0}`);
console.log(`Types: pro=${typeCounts['pro']||0}, captain=${typeCounts['captain']||0}`);
console.log(`Unique organizers: ${allOrganizers.size}`);
console.log(`Unique players: ${allPlayers.size}`);
console.log(`Global fill rate: ${globalFillRate}%`);
console.log(`Centres partenaires: ${centreAnalysis.size}`);
