#!/usr/bin/env node
/**
 * One-shot verification of the recurring-games fix (commit 550cb1d).
 *
 * Runs shortly after the 11:00 scheduleGames cron and answers the only
 * question that matters: did the structural fix work, or did we just get a
 * one-off backfill on 3 Aug that will decay again?
 *
 * The signal is NOT "25 Aug appeared" - a single run creating the newest day
 * proves little. It is "24 Aug got THICKER". Under the old code a day that
 * entered the window thin stayed thin forever, because the job only ever
 * probed two fixed week offsets. The new walk revisits every occurrence in
 * the horizon on every run, so a growing 24 Aug is proof the walk works.
 *
 * Usage: node verify_schedulegames.js [--dry]
 */

const { execFileSync } = require('child_process');
const admin = require('/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/firebase-admin');
const { DateTime } = require('/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/luxon');
const R = require('/Users/tmgnr/poteau-workspace/scripts/slack_report.js');

const SA = '/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json';
const ACCOUNT = 'firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com';
const TZ = 'Europe/Paris';
const DRY = process.argv.includes('--dry');

// Measured on 2026-08-03 after the backfill, before the first daily run.
const BASELINE = { '2026-08-24': 24, '2026-08-25': 0, horizon: 21 };

admin.initializeApp({ credential: admin.credential.cert(require(SA)), projectId: 'krank-club' });
const db = admin.firestore();

(async () => {
    const now = DateTime.now().setZone(TZ);

    // Did the job actually fire today?
    let lastAttempt = null, cronErr = null;
    try {
        execFileSync('gcloud', ['config', 'set', 'core/account', ACCOUNT], { stdio: 'pipe' });
        const raw = execFileSync('gcloud', ['scheduler', 'jobs', 'list', '--project=krank-club',
            '--location=europe-west1', '--format=value(name.basename(),lastAttemptTime)'],
            { encoding: 'utf8' });
        const line = raw.split('\n').find(l => /scheduleGames/i.test(l));
        if (line) lastAttempt = DateTime.fromISO(line.split('\t')[1]);
    } catch (e) { cronErr = String(e.stderr || e.message).split('\n')[0]; }

    // Current per-day counts across the horizon.
    const snap = await db.collection('games')
        .where('date', '>=', new Date()).where('status', '==', 'published').get();
    const byDay = {};
    snap.forEach(d => {
        const k = DateTime.fromJSDate(d.data().date.toDate()).setZone(TZ).toISODate();
        byDay[k] = (byDay[k] || 0) + 1;
    });

    // Contiguous horizon depth, starting from the first day that has games
    // (late in the day, "today" holds no future games - see the daily report).
    const today = now.startOf('day');
    let cursor = null;
    for (const c of [today, today.plus({ days: 1 })]) if (byDay[c.toISODate()]) { cursor = c; break; }
    let last = null;
    if (cursor) for (; byDay[cursor.toISODate()]; cursor = cursor.plus({ days: 1 })) last = cursor.toISODate();
    const depth = last ? Math.round(DateTime.fromISO(last).diff(today, 'days').days) : 0;

    const d24 = byDay['2026-08-24'] || 0;
    const d25 = byDay['2026-08-25'] || 0;
    const grew = d24 - BASELINE['2026-08-24'];

    // Correctness checks: no past-dated games, no weekday mismatches.
    const reps = await db.collection('repeaters').where('status', '==', 'published').get();
    const repById = new Map();
    reps.forEach(d => repById.set(d.id, d.data()));
    let pastDated = 0, wrongWeekday = 0;
    snap.forEach(d => {
        const g = d.data();
        if (!g.repeater) return;
        const r = repById.get(g.repeater.id);
        if (!r) return;
        const local = DateTime.fromJSDate(g.date.toDate()).setZone(r.timeZone || TZ);
        if (local < now) pastDated++;
        if (r.weekday && local.weekday !== r.weekday) wrongWeekday++;
    });

    const findings = [];
    const firedToday = lastAttempt && lastAttempt.setZone(TZ).hasSame(now, 'day');

    if (cronErr) {
        findings.push(R.red('Could not read Cloud Scheduler', cronErr,
            'the run may still have happened — check the console'));
    } else if (!firedToday) {
        findings.push(R.red('scheduleGames did not run today',
            `last attempt ${lastAttempt ? lastAttempt.setZone(TZ).toFormat('d LLL HH:mm') : 'never'}`,
            'the daily cron is not firing — check Cloud Scheduler, the fix is not live'));
    }
    if (wrongWeekday) findings.push(R.red(`${wrongWeekday} games on the wrong weekday`,
        'a generated game does not match its repeater weekday',
        'inspect those games — the timezone anchoring may be wrong'));
    if (pastDated) findings.push(R.red(`${pastDated} past-dated games`,
        'games created in the past are invisible to users but pollute the collection',
        'check the past-slot guard in scheduleGames'));
    if (firedToday && grew <= 0 && d24 > 0) findings.push(R.amber('24 Aug did not thicken',
        `still ${d24} games, same as before the run`,
        'the walk may not be revisiting existing days — verify the horizon loop'));
    if (depth < 20) findings.push(R.red(`Horizon is ${depth} days`, 'target is 21',
        'check whether the run completed — it may have timed out'));

    const verdict = findings.length === 0
        ? `The structural fix works. 24 Aug grew ${BASELINE['2026-08-24']} → ${d24} (+${grew}) — the daily walk revisits days already inside the window, which is exactly what the old code could not do. 25 Aug entered the window with ${d25}.`
        : null;

    await (DRY ? Promise.resolve() : Promise.resolve()); // no-op, keeps shape

    const payload = R.build({
        title: 'scheduleGames — first daily run',
        subtitle: `verifying commit 550cb1d · ran ${lastAttempt ? lastAttempt.setZone(TZ).toFormat('HH:mm') : '—'} · horizon ${depth}d`,
        summary: verdict || `Checked the first daily run of scheduleGames. ${findings.length} issue${findings.length === 1 ? '' : 's'} found.`,
        findings,
        table: {
            label: 'Horizon',
            note: 'vs 3 Aug, after backfill',
            columns: ['3 Aug', 'now'],
            rows: [
                ['24 Aug', BASELINE['2026-08-24'], d24],
                ['25 Aug', BASELINE['2026-08-25'], d25],
                ['horizon d', BASELINE.horizon, depth],
            ],
        },
        quiet: [`${reps.size} repeaters`, `${pastDated} past-dated`, `${wrongWeekday} weekday errors`],
        footer: 'one-shot check · scheduled 2026-08-04',
    });

    if (DRY) { console.log(JSON.stringify(payload, null, 1)); process.exit(0); }
    console.log('slack:', R.post(payload));
    process.exit(0);
})().catch(e => { console.error('VERIFY FAILED:', e); process.exit(1); });
