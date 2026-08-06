/**
 * Set `sport: 'soccer'` on played games that carry no sport field.
 *
 * Two games (both dateless orphans, repaired 2026-08-06) predate the padel
 * launch and never got a sport. recomputeUserStats defaulted them to soccer at
 * READ time (`game.sport || "soccer"`), which invented data: two users showed a
 * soccer game nobody had recorded as soccer.
 *
 * Tim, 2026-08-06: "no sports means soccer" — the field postdates the games.
 * Recording it makes the value derived rather than assumed, so the recompute
 * can drop its guess and skip anything it genuinely cannot classify.
 *
 * SCOPE: played games only. 1,813 games lack a sport in total, but 1,811 are
 * drafts, unplayed published games, or cancellations -- none of which any stat
 * reads. The padel-launch backfill covered played history and left the rest.
 * Widening this to all games would rewrite drafts and future fixtures for no
 * stats benefit, so it is deliberately out of scope here.
 *
 * Usage: node backfill_missing_sport.js [--write]
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();
const WRITE = process.argv.includes('--write');

(async () => {
    console.log(WRITE ? '*** WRITE MODE ***\n' : '--- DRY RUN ---\n');
    const targets = [];
    let last = null;
    let scanned = 0;

    for (;;) {
        let q = db
            .collection('games')
            .where('status', '==', 'played')
            .orderBy('__name__')
            .limit(2000);
        if (last) q = q.startAfter(last);
        const snap = await q.get();
        if (snap.empty) break;
        snap.forEach((d) => {
            scanned++;
            const g = d.data();
            const missing = g.sport === undefined || g.sport === null || g.sport === '';
            if (missing) targets.push({ id: d.id, ref: d.ref, status: g.status });
        });
        last = snap.docs[snap.docs.length - 1].id;
        if (snap.size < 2000) break;
    }

    console.log(`Scanned ${scanned} games — ${targets.length} without a sport.\n`);
    for (const t of targets) {
        console.log(`  ${t.id}  status=${t.status} -> sport=soccer`);
        if (WRITE) {
            await t.ref.update({ sport: 'soccer' });
            console.log('     written');
        }
    }
    console.log(WRITE ? `\nDone. ${targets.length} updated.` : '\nDry run. Re-run with --write.');
    process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
