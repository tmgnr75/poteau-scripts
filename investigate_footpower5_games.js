const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

const SUSPECTS = {
    sVaBM5QOhtNMAxWYSXKGm9H0Arf2: 'Kassim',
    TBi7xlZkIgcTwhoT3JXmuO6xuMS2: 'Fawzi Fawzi',
    q0R7EVydkUhwJLqncbal7g7Vcp13: 'Anis Tabu',
};

async function main() {
    // 1. Find the Foot Power 5 centre(s)
    console.log('=== Finding Foot Power 5 centre ===');
    const centresSnap = await db.collection('users')
        .where('type', 'in', ['pro', 'super_pro'])
        .get();
    const centres = [];
    centresSnap.forEach(d => {
        const name = (d.data().centre_name || '').toLowerCase();
        if (name.includes('power') || name.includes('foot power')) {
            centres.push({ uid: d.id, centre_name: d.data().centre_name, place_id: d.data().centre_place_id, tz: d.data().time_zone });
        }
    });
    console.log(JSON.stringify(centres, null, 2));

    const centreUids = new Set(centres.map(c => c.uid));

    // 2. For each suspect, pull their games and look at when they joined/left full games.
    for (const [uid, name] of Object.entries(SUSPECTS)) {
        console.log(`\n\n======== ${name} (${uid}) ========`);
        const userDoc = await db.collection('users').doc(uid).get();
        const u = userDoc.data();
        const gameRefs = [...(u.played_games || []), ...(u.games || []), ...(u.upcoming_games || [])];
        const uniq = [...new Map(gameRefs.map(r => [r.path, r])).values()];
        console.log(`Total distinct game refs: ${uniq.length}`);

        for (const ref of uniq) {
            let g;
            try { g = await ref.get(); } catch (e) { continue; }
            if (!g.exists) continue;
            const d = g.data();
            const isFootPower = centreUids.has(d.centre) ||
                (d.address || '').toLowerCase().includes('power') ||
                (d.reservation_name || '').toLowerCase().includes('power');
            // Is this suspect actually in attendees right now?
            const attendees = (d.attendees || []).map(a => a?.path || a);
            const stillIn = attendees.some(p => typeof p === 'string' && p.includes(uid));
            console.log(`  game ${g.id} | ${ts(d.date)} | status=${d.status} | centre=${d.centre} | footpower=${isFootPower} | maxP=${d.max_players} | attendees=${attendees.length} | stillAttendee=${stillIn} | addr=${(d.address||'').slice(0,40)}`);
        }
    }

    // 3. Find ALL games at Foot Power 5 centre, recent, and inspect attendees + the 05-08 ~19:30 one
    if (centreUids.size) {
        console.log('\n\n======== Foot Power 5 games (centre-hosted) ========');
        for (const cu of centreUids) {
            const gs = await db.collection('games').where('centre', '==', cu).get();
            const rows = [];
            gs.forEach(g => {
                const d = g.data();
                rows.push({ id: g.id, date: ts(d.date), status: d.status, maxP: d.max_players, attendees: (d.attendees||[]).length, outsiders: (d.outsiders||[]).length, noShow: (d.no_show_players||[]).length });
            });
            rows.sort((a,b)=> (a.date||'').localeCompare(b.date||''));
            rows.forEach(r => console.log('  ' + JSON.stringify(r)));
        }
    }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
