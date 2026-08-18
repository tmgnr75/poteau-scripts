const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const ts = v => v?.toDate ? v.toDate().toISOString() : (v || null);

// The accounts that filled the May 8 Foot Power 5 games with 4 phantom friends each.
const SUSPECTS = {
    'SVrYNk7dLcaFrjvY1y7IrGn6TXh1': 'Grisha',
    'hNL25FRWJwW78vTlyGpURjafpL13': 'Zandicare Kenpachi',
    '9B3ITYtJ2sdgDfmx8DhIVDOnFpw2': 'Alexei Mocanu',
    'YxRPaeJkahMRMf8533VjReX7Wzv2': "Saint'",
};

async function userSummary(uid) {
    const d = (await db.collection('users').doc(uid).get()).data() || {};
    return {
        uid, name: d.display_name, email: d.email, phone: d.phone_number,
        created: ts(d.created_time), last_activity: ts(d.last_activity_date),
        banned: d.banned || false, country: d.country, country_code: d.country_code,
        appVersion: d.app_version, connector: d.connector,
        no_show: (d.no_show_reports||[]).length, late: (d.late_reports||[]).length,
        rude: (d.rude_reports||[]).length, positive: (d.positive_reports||[]).length,
        played: (d.played_games||[]).length, games: (d.games||[]).length,
        friends: (d.friends||[]).length, blocked: (d.blocked_users||[]).length,
        _games: [...(d.played_games||[]), ...(d.games||[]), ...(d.upcoming_games||[])],
    };
}

async function main() {
    const summaries = {};
    for (const uid of Object.keys(SUSPECTS)) {
        summaries[uid] = await userSummary(uid);
        const s = summaries[uid];
        console.log('\n=== ' + s.name + ' ===');
        console.log(JSON.stringify({ ...s, _games: undefined }, null, 2));
    }

    // For each suspect, look at every game they're attached to: did they join-plus-4 and did it actually get played by them?
    console.log('\n\n##### PER-SUSPECT GAME-BY-GAME BEHAVIOUR #####');
    for (const uid of Object.keys(SUSPECTS)) {
        const s = summaries[uid];
        const uniq = [...new Map(s._games.map(r => [r.path, r])).values()];
        console.log(`\n======== ${s.name} (${uid}) — ${uniq.length} games ========`);
        for (const ref of uniq) {
            let g; try { g = await ref.get(); } catch { continue; }
            if (!g.exists) continue;
            const d = g.data();
            // count how many times this uid appears in attendees (plus_one duplication)
            const att = (d.attendees||[]).map(a=>a?.path||'');
            const myCount = att.filter(p => p.includes(uid)).length;
            // pull this game's join/leave log lines for this user
            let joinLeave = '';
            try {
                const msgs = await db.collection('messages').where('game_id','==',g.ref).get();
                const lines=[];
                msgs.forEach(m=>{const md=m.data(); if((md.type==='log') && (md.author_name===s.name)) lines.push(`${ts(md.created)}:${md.trigger}`);});
                lines.sort();
                joinLeave = lines.join(' | ');
            } catch {}
            console.log(`  ${g.id} | ${ts(d.date)} | ${d.centre} | status=${d.status} | spots_used_by_me=${myCount} | maxP=${d.max_players} | log[${joinLeave}]`);
        }
    }

    // Pairing analysis: which suspects keep appearing in the SAME games?
    console.log('\n\n##### CO-OCCURRENCE (same game, multiple suspects) #####');
    const gameMembers = {};
    for (const uid of Object.keys(SUSPECTS)) {
        const uniq = [...new Map(summaries[uid]._games.map(r => [r.path, r])).values()];
        for (const ref of uniq) {
            (gameMembers[ref.id] = gameMembers[ref.id] || new Set()).add(SUSPECTS[uid]);
        }
    }
    for (const [gid, set] of Object.entries(gameMembers)) {
        if (set.size > 1) console.log(`  ${gid}: ${[...set].join(' + ')}`);
    }
}

main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
