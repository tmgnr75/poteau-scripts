const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, 'exports', 'padel_games_export.json');
const games = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    // Handle DD/MM/YYYY HH:mm format
    const match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
    if (match) {
        return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]), parseInt(match[4]), parseInt(match[5]));
    }
    // Try ISO
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

console.log('=== EXTRACTING PADEL CONTACT LISTS ===\n');
console.log(`Loaded ${games.length} games from JSON\n`);

// ===========================
// 3.1 - ORGANIZERS
// ===========================
console.log('[3.1] Extracting organizers...');

const organizersMap = new Map();

for (const game of games) {
    const uid = game.organizer_uid;
    if (!uid) continue;

    const gameDate = parseDate(game.date);

    if (!organizersMap.has(uid)) {
        organizersMap.set(uid, {
            uid,
            display_name: game.organizer_name,
            phone_number: game.organizer_phone,
            email: game.organizer_email,
            type: game.organizer_type,
            centre_name: game.organizer_centre_name || '',
            games_count: 0,
            first_game: null,
            last_game: null,
        });
    }

    const org = organizersMap.get(uid);
    org.games_count++;
    if (gameDate) {
        if (!org.first_game || gameDate < org.first_game) org.first_game = gameDate;
        if (!org.last_game || gameDate > org.last_game) org.last_game = gameDate;
    }
}

const organizers = [...organizersMap.values()].sort((a, b) => b.games_count - a.games_count);

const orgHeaders = ['uid', 'display_name', 'phone_number', 'email', 'type', 'centre_name', 'nombre_de_games_crees', 'premier_game_cree', 'dernier_game_cree'];
const orgLines = [orgHeaders.join(';')];
for (const org of organizers) {
    orgLines.push([
        escapeCSV(org.uid),
        escapeCSV(org.display_name),
        escapeCSV(org.phone_number),
        escapeCSV(org.email),
        escapeCSV(org.type),
        escapeCSV(org.centre_name),
        org.games_count,
        formatDate(org.first_game),
        formatDate(org.last_game),
    ].join(';'));
}

const orgPath = path.join(__dirname, 'exports', 'padel_organizers.csv');
fs.writeFileSync(orgPath, '\uFEFF' + orgLines.join('\n'), { encoding: 'utf8' });
console.log(`[3.1] Exported ${organizers.length} organizers to ${orgPath}`);

// ===========================
// 3.2 - PLAYERS (ATTENDEES)
// ===========================
console.log('[3.2] Extracting players...');

const playersMap = new Map();
const organizerUids = new Set(organizersMap.keys());

for (const game of games) {
    if (!game.attendees_uids) continue;
    const uids = game.attendees_uids.split(', ').filter(Boolean);
    const names = game.attendees_list || '';
    const gameDate = parseDate(game.date);

    // Parse attendees_list to extract individual entries
    // Format: "Name1 (phone/email), Name2 (phone/email)"
    const attendeeEntries = [];
    if (names) {
        const regex = /([^,]+?\([^)]*\))/g;
        let match;
        while ((match = regex.exec(names)) !== null) {
            attendeeEntries.push(match[1].trim());
        }
    }

    // Use unique UIDs (a player can appear multiple times as +1)
    const uniqueUidsInGame = [...new Set(uids)];

    for (const uid of uniqueUidsInGame) {
        if (!uid) continue;

        if (!playersMap.has(uid)) {
            // Try to find this user's info from attendees_list
            let displayName = '';
            let contact = '';

            // Find the first entry matching this UID from any game
            const entryIdx = uids.indexOf(uid);
            if (entryIdx >= 0 && entryIdx < attendeeEntries.length) {
                const entry = attendeeEntries[entryIdx];
                const nameMatch = entry.match(/^(.+?)\s*\((.+?)\)$/);
                if (nameMatch) {
                    displayName = nameMatch[1].trim();
                    contact = nameMatch[2].trim();
                }
            }

            playersMap.set(uid, {
                uid,
                display_name: displayName,
                phone_number: contact.startsWith('+') ? contact : '',
                email: contact.includes('@') ? contact : '',
                games_joined: 0,
                first_game: null,
                last_game: null,
                is_also_organizer: organizerUids.has(uid),
            });
        }

        const player = playersMap.get(uid);
        player.games_joined++;
        if (gameDate) {
            if (!player.first_game || gameDate < player.first_game) player.first_game = gameDate;
            if (!player.last_game || gameDate > player.last_game) player.last_game = gameDate;
        }
    }
}

const players = [...playersMap.values()].sort((a, b) => b.games_joined - a.games_joined);

const playerHeaders = ['uid', 'display_name', 'phone_number', 'email', 'nombre_de_games_rejoints', 'premier_game', 'dernier_game', 'est_aussi_organisateur'];
const playerLines = [playerHeaders.join(';')];
for (const p of players) {
    playerLines.push([
        escapeCSV(p.uid),
        escapeCSV(p.display_name),
        escapeCSV(p.phone_number),
        escapeCSV(p.email),
        p.games_joined,
        formatDate(p.first_game),
        formatDate(p.last_game),
        p.is_also_organizer ? 'oui' : 'non',
    ].join(';'));
}

const playerPath = path.join(__dirname, 'exports', 'padel_players.csv');
fs.writeFileSync(playerPath, '\uFEFF' + playerLines.join('\n'), { encoding: 'utf8' });
console.log(`[3.2] Exported ${players.length} players to ${playerPath}`);

// ===========================
// 3.3 - CENTRES PARTENAIRES
// ===========================
console.log('[3.3] Extracting centres...');

const centresMap = new Map();

for (const game of games) {
    if (game.type !== 'pro') continue;

    // Use organizer UID as centre ID since pro organizers represent centres
    const centreId = game.organizer_uid;
    const centreName = game.centre || game.organizer_centre_name || game.organizer_name;
    const gameDate = parseDate(game.date);

    if (!centresMap.has(centreId)) {
        centresMap.set(centreId, {
            centre_id: centreId,
            centre_name: centreName,
            centre_address: game.address || '',
            place_id: game.place_id || '',
            games_total: 0,
            games_played: 0,
            games_canceled: 0,
            games_published: 0,
            games_hidden: 0,
            total_attendees: 0,
            total_max_players: 0,
            first_game: null,
            last_game: null,
        });
    }

    const centre = centresMap.get(centreId);
    centre.games_total++;

    switch (game.status) {
        case 'played': centre.games_played++; break;
        case 'canceled': centre.games_canceled++; break;
        case 'published': centre.games_published++; break;
        case 'hidden': centre.games_hidden++; break;
    }

    centre.total_attendees += game.attendees_count || 0;
    centre.total_max_players += game.max_players || 0;

    if (gameDate) {
        if (!centre.first_game || gameDate < centre.first_game) centre.first_game = gameDate;
        if (!centre.last_game || gameDate > centre.last_game) centre.last_game = gameDate;
    }
}

const centres = [...centresMap.values()].sort((a, b) => b.games_total - a.games_total);

const centreHeaders = [
    'centre_id', 'centre_name', 'centre_address', 'place_id',
    'nombre_de_games_crees', 'nombre_de_games_played', 'nombre_de_games_canceled',
    'nombre_de_games_published', 'nombre_de_games_hidden',
    'total_joueurs_ayant_rejoint', 'taux_de_remplissage_moyen',
    'premier_game', 'dernier_game'
];
const centreLines = [centreHeaders.join(';')];
for (const c of centres) {
    const fillRate = c.total_max_players > 0
        ? ((c.total_attendees / c.total_max_players) * 100).toFixed(1) + '%'
        : 'N/A';
    centreLines.push([
        escapeCSV(c.centre_id),
        escapeCSV(c.centre_name),
        escapeCSV(c.centre_address),
        escapeCSV(c.place_id),
        c.games_total,
        c.games_played,
        c.games_canceled,
        c.games_published,
        c.games_hidden,
        c.total_attendees,
        fillRate,
        formatDate(c.first_game),
        formatDate(c.last_game),
    ].join(';'));
}

const centrePath = path.join(__dirname, 'exports', 'padel_centres.csv');
fs.writeFileSync(centrePath, '\uFEFF' + centreLines.join('\n'), { encoding: 'utf8' });
console.log(`[3.3] Exported ${centres.length} centres to ${centrePath}`);

// ===========================
// SUMMARY
// ===========================
console.log('\n=== SUMMARY ===');
console.log(`Organizers: ${organizers.length}`);
console.log(`  - Pro: ${organizers.filter(o => o.type === 'pro').length}`);
console.log(`  - Players: ${organizers.filter(o => o.type !== 'pro').length}`);
console.log(`Players: ${players.length}`);
console.log(`  - Also organizers: ${players.filter(p => p.is_also_organizer).length}`);
console.log(`Centres partenaires: ${centres.length}`);

console.log('\nTop 5 organizers:');
organizers.slice(0, 5).forEach((o, i) => {
    console.log(`  ${i + 1}. ${o.display_name} (${o.type}) - ${o.games_count} games`);
});

console.log('\nTop 5 players:');
players.slice(0, 5).forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.display_name} - ${p.games_joined} games`);
});

console.log('\nCentres partenaires:');
centres.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.centre_name} - ${c.games_total} games (${c.games_played} played, ${c.games_canceled} canceled, ${c.games_published} published)`);
});

console.log('\nDone!');
