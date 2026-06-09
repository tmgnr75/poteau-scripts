const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const AXEL_UID = 'XNPognOy0OgAklzAAknSsuvjTwN2';

async function main() {
    // Find games organized by Axel
    const snap = await db.collection('games').where('organizer', '==', AXEL_UID).get();
    console.log(`Found ${snap.size} games organized by Axel total.\n`);

    const matches = [];
    snap.forEach(doc => {
        const d = doc.data();
        const date = d.date ? d.date.toDate() : null;
        // Filter to June 20, 2026
        if (date && date.getUTCFullYear() === 2026 && date.getUTCMonth() === 5 && date.getUTCDate() >= 19 && date.getUTCDate() <= 21) {
            matches.push({ id: doc.id, d, date });
        }
    });

    // Also broaden: search by address containing Soctainer regardless of organizer date filter
    console.log(`Games by Axel around June 20 2026: ${matches.length}\n`);

    matches.sort((a, b) => {
        const ca = a.d.created_on ? a.d.created_on.toDate().getTime() : 0;
        const cb = b.d.created_on ? b.d.created_on.toDate().getTime() : 0;
        return ca - cb;
    });

    matches.forEach((m, i) => {
        const created = m.d.created_on ? m.d.created_on.toDate().toISOString() : 'N/A';
        console.log(`[${i}] game ${m.id}`);
        console.log(`    address: ${m.d.address}`);
        console.log(`    centre: ${m.d.centre}`);
        console.log(`    date: ${m.date.toISOString()}  | created_on: ${created}`);
        console.log(`    status: ${m.d.status} | max_players: ${m.d.max_players} | sport: ${m.d.sport}`);
        console.log(`    organizer: ${m.d.organizer}`);
        console.log(`    attendees: ${(m.d.attendees || []).map(r => r.id).join(', ') || '(none)'}`);
        console.log(`    teams (${(m.d.teams || []).length}): ${JSON.stringify((m.d.teams || []).map(t => ({ status: t.status, p: t.player ? t.player.id : null })))}`);
        console.log(`    interested: ${(m.d.interested || []).length} | messages: ${(m.d.messages || []).length} | reservation_name: ${m.d.reservation_name}`);
        console.log('');
    });
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
