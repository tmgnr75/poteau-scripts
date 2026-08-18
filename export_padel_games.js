const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Caches
const usersCache = new Map();
const centresCache = new Map();

function formatDate(ts) {
    if (!ts) return '';
    const d = ts instanceof admin.firestore.Timestamp ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

function formatDateISO(ts) {
    if (!ts) return '';
    const d = ts instanceof admin.firestore.Timestamp ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    return d.toISOString();
}

async function batchGetUsers(userIds) {
    const unknownIds = userIds.filter(id => !usersCache.has(id));
    if (unknownIds.length === 0) return;

    // Firestore getAll supports up to 100 refs at a time
    const chunks = [];
    for (let i = 0; i < unknownIds.length; i += 100) {
        chunks.push(unknownIds.slice(i, i + 100));
    }

    for (const chunk of chunks) {
        const refs = chunk.map(id => db.collection('users').doc(id));
        const docs = await db.getAll(...refs);
        docs.forEach((doc, idx) => {
            if (doc.exists) {
                const data = doc.data();
                usersCache.set(chunk[idx], {
                    uid: chunk[idx],
                    display_name: data.display_name || '',
                    email: data.email || '',
                    phone_number: data.phone_number || '',
                    type: data.type || '',
                    centre_name: data.centre_name || '',
                    centre_address: data.centre_address || '',
                    centre_place_id: data.centre_place_id || '',
                    sports: data.sports || [],
                });
            } else {
                usersCache.set(chunk[idx], {
                    uid: chunk[idx],
                    display_name: 'Utilisateur supprimé',
                    email: '',
                    phone_number: '',
                    type: '',
                    centre_name: '',
                    centre_address: '',
                    centre_place_id: '',
                    sports: [],
                });
            }
        });
    }
}

function escapeCSV(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(';') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

async function main() {
    try {
        console.log('=== EXPORT PADEL GAMES ===\n');

        // 1. Fetch ALL padel games
        console.log('[FETCH] Retrieving all padel games...');
        const gamesSnap = await db.collection('games').where('sport', '==', 'padel').get();
        console.log(`[FETCH] Found ${gamesSnap.size} padel games\n`);

        const allGames = [];
        const allUserIds = new Set();

        // Collect all user IDs first for batch fetching
        console.log('[PREP] Collecting user IDs for batch fetch...');
        gamesSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.organizer) allUserIds.add(data.organizer);
            if (data.attendees && Array.isArray(data.attendees)) {
                data.attendees.forEach(ref => {
                    if (ref && ref.id) allUserIds.add(ref.id);
                    else if (typeof ref === 'string') allUserIds.add(ref);
                });
            }
            if (data.interested && Array.isArray(data.interested)) {
                data.interested.forEach(ref => {
                    if (ref && ref.id) allUserIds.add(ref.id);
                    else if (typeof ref === 'string') allUserIds.add(ref);
                });
            }
        });

        console.log(`[PREP] Found ${allUserIds.size} unique user IDs to fetch`);

        // 2. Batch fetch all users
        console.log('[FETCH] Batch fetching user profiles...');
        await batchGetUsers([...allUserIds]);
        console.log(`[FETCH] Cached ${usersCache.size} user profiles\n`);

        // 3. Process each game
        console.log('[PROCESS] Processing games...');
        let processed = 0;

        for (const doc of gamesSnap.docs) {
            const data = doc.data();
            const gameId = doc.id;

            // Organizer info
            const organizerUser = usersCache.get(data.organizer) || { uid: data.organizer, display_name: 'Inconnu', email: '', phone_number: '', type: '', centre_name: '' };

            // Attendees
            const attendeeIds = [];
            if (data.attendees && Array.isArray(data.attendees)) {
                data.attendees.forEach(ref => {
                    const id = ref && ref.id ? ref.id : (typeof ref === 'string' ? ref : null);
                    if (id) attendeeIds.push(id);
                });
            }
            const attendeeUsers = attendeeIds.map(id => usersCache.get(id) || { uid: id, display_name: 'Utilisateur supprimé', phone_number: '', email: '' });
            const attendeesStr = attendeeUsers.map(u => `${u.display_name} (${u.phone_number || u.email || u.uid})`).join(', ');

            // Interested
            const interestedIds = [];
            if (data.interested && Array.isArray(data.interested)) {
                data.interested.forEach(ref => {
                    const id = ref && ref.id ? ref.id : (typeof ref === 'string' ? ref : null);
                    if (id) interestedIds.push(id);
                });
            }
            const interestedUsers = interestedIds.map(id => usersCache.get(id) || { uid: id, display_name: 'Utilisateur supprimé', phone_number: '', email: '' });
            const interestedStr = interestedUsers.map(u => `${u.display_name} (${u.phone_number || u.email || u.uid})`).join(', ');

            // Teams info
            let teamsStr = '';
            if (data.teams && Array.isArray(data.teams)) {
                teamsStr = data.teams.map(t => {
                    const userName = t.user_id ? (usersCache.get(t.user_id)?.display_name || t.user_id) : 'open';
                    return `${t.team_side}:${t.status}:${userName}${t.plus_one ? ' (+1)' : ''}`;
                }).join(' | ');
            }

            // Repeater ref
            let repeaterRefId = '';
            if (data.repeater) {
                if (data.repeater instanceof admin.firestore.DocumentReference) {
                    repeaterRefId = data.repeater.id;
                } else if (typeof data.repeater === 'string') {
                    repeaterRefId = data.repeater;
                }
            }

            // Payments
            let paymentsCount = 0;
            let paymentIds = '';
            if (data.payments && Array.isArray(data.payments)) {
                paymentsCount = data.payments.length;
                paymentIds = data.payments.map(p => p && p.id ? p.id : String(p)).join(', ');
            }

            // Level deltas
            const levelDeltasStr = data.level_deltas && Array.isArray(data.level_deltas) ? data.level_deltas.join(', ') : '';

            const gameRecord = {
                docid: gameId,
                date: formatDate(data.date),
                date_iso: formatDateISO(data.date),
                end_time: formatDate(data.end_time),
                created_on: formatDate(data.created_on),
                created_on_iso: formatDateISO(data.created_on),
                sport: data.sport || '',
                status: data.status || '',
                type: data.type || '',
                centre: data.centre || '',
                address: data.address || '',
                place_id: data.place_id || '',
                country_code: data.country_code || '',
                time_zone: data.time_zone || '',
                max_players: data.max_players || '',
                duration: data.duration || '',
                price: data.price != null ? data.price : '',
                price_undiscounted: data.price_undiscounted != null ? data.price_undiscounted : '',
                currency: data.currency || '',
                payment_type: data.payment_type || '',
                mood: data.mood || '',
                visibility: data.visibility || '',
                gold_exclusive: data.gold_exclusive != null ? data.gold_exclusive : '',
                fff_game: data.fff_game != null ? data.fff_game : '',
                description: data.description || '',
                reservation_name: data.reservation_name || '',
                players_to_find: data.players_to_find != null ? data.players_to_find : '',
                level_deltas: levelDeltasStr,
                // Location
                latitude: data.location ? data.location.latitude : '',
                longitude: data.location ? data.location.longitude : '',
                // Organizer
                organizer_uid: data.organizer || '',
                organizer_name: organizerUser.display_name,
                organizer_email: organizerUser.email,
                organizer_phone: organizerUser.phone_number,
                organizer_type: organizerUser.type,
                organizer_centre_name: organizerUser.centre_name,
                // Attendees
                attendees_count: attendeeIds.length,
                attendees_list: attendeesStr,
                attendees_uids: attendeeIds.join(', '),
                // Interested
                interested_count: interestedIds.length,
                interested_list: interestedStr,
                // Teams
                teams_detail: teamsStr,
                // Repeater
                repeater_id: repeaterRefId,
                // Payments
                payments_count: paymentsCount,
                payment_ids: paymentIds,
                payment_link: data.payment_link || '',
            };

            allGames.push(gameRecord);
            processed++;

            if (processed % 100 === 0) {
                console.log(`[PROCESS] ${processed}/${gamesSnap.size} games processed`);
            }
        }

        console.log(`[PROCESS] ${processed}/${gamesSnap.size} games processed - DONE\n`);

        // Sort by date
        allGames.sort((a, b) => {
            if (!a.date_iso && !b.date_iso) return 0;
            if (!a.date_iso) return 1;
            if (!b.date_iso) return -1;
            return a.date_iso.localeCompare(b.date_iso);
        });

        // 4. Export CSV
        const exportDir = path.join(__dirname, 'exports');
        if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir, { recursive: true });

        const csvHeaders = [
            'docid', 'date', 'end_time', 'created_on', 'sport', 'status', 'type', 'centre', 'address',
            'place_id', 'country_code', 'time_zone', 'max_players', 'duration', 'price', 'price_undiscounted',
            'currency', 'payment_type', 'mood', 'visibility', 'gold_exclusive', 'fff_game', 'description',
            'reservation_name', 'players_to_find', 'level_deltas', 'latitude', 'longitude',
            'organizer_uid', 'organizer_name', 'organizer_email', 'organizer_phone', 'organizer_type', 'organizer_centre_name',
            'attendees_count', 'attendees_list', 'attendees_uids',
            'interested_count', 'interested_list',
            'teams_detail', 'repeater_id', 'payments_count', 'payment_ids', 'payment_link'
        ];

        const csvLines = [csvHeaders.join(';')];
        for (const game of allGames) {
            const line = csvHeaders.map(h => escapeCSV(game[h])).join(';');
            csvLines.push(line);
        }

        const csvContent = '\uFEFF' + csvLines.join('\n');
        const csvPath = path.join(exportDir, 'padel_games_export.csv');
        fs.writeFileSync(csvPath, csvContent, { encoding: 'utf8' });
        console.log(`[CSV] Exported ${allGames.length} games to ${csvPath}`);

        // 5. Export JSON
        const jsonPath = path.join(exportDir, 'padel_games_export.json');
        fs.writeFileSync(jsonPath, JSON.stringify(allGames, null, 2), { encoding: 'utf8' });
        console.log(`[JSON] Exported ${allGames.length} games to ${jsonPath}`);

        // 6. Quick summary
        console.log('\n=== SUMMARY ===');
        console.log(`Total games: ${allGames.length}`);
        const statuses = {};
        const types = {};
        allGames.forEach(g => {
            statuses[g.status] = (statuses[g.status] || 0) + 1;
            types[g.type] = (types[g.type] || 0) + 1;
        });
        console.log('By status:', JSON.stringify(statuses));
        console.log('By type:', JSON.stringify(types));
        console.log(`Date range: ${allGames[0]?.date || 'N/A'} → ${allGames[allGames.length - 1]?.date || 'N/A'}`);
        console.log(`Unique users cached: ${usersCache.size}`);

    } catch (error) {
        console.error('[ERROR]', error);
    } finally {
        await admin.app().delete();
    }
}

main();
