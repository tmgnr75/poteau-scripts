#!/usr/bin/env node
/**
 * Poteau daily health report.
 *
 * Gathers yesterday's production state and posts a dashboard to Slack.
 * Designed to run unattended from launchd at 08:30 Europe/Paris.
 *
 * Usage:
 *   node daily_health_report.js              # report on yesterday, post to Slack
 *   node daily_health_report.js --dry        # print the payload, post nothing
 *   node daily_health_report.js --date=2026-08-02   # backfill a specific day
 *
 * See DAILY_HEALTH_REPORT_BRIEF.md for why each check exists.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const admin = require('/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/firebase-admin');
const { DateTime } = require('/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/luxon');

const SA_PATH = '/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json';
const WEBHOOK_ENV = `${process.env.HOME}/.poteau/slack_webhook.env`;
const PROJECT = 'krank-club';
const TZ = 'Europe/Paris';

// Two different identities are required. The admin SA can read logs but NOT
// scheduler jobs; tim@ can read scheduler jobs. Neither can do both.
const ACCOUNT_LOGS = 'firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com';
const ACCOUNT_SCHEDULER = 'tim@poteau.team';

const DRY = process.argv.includes('--dry');
const dateArg = (process.argv.find(a => a.startsWith('--date=')) || '').split('=')[1];

admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
const db = admin.firestore();

function gcloud(args, account) {
    if (account) execFileSync('gcloud', ['config', 'set', 'core/account', account], { stdio: 'pipe' });
    return execFileSync('gcloud', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// ---------------------------------------------------------------- activity

const FIELDS = {
    games: 'created_on', users: 'created_time', messages: 'created',
    payments: 'authorization_date', alerts: 'created', availabilities: 'created_at',
    quiz_replies: 'created_at', user_invitations: 'created', draft_games: 'created_on',
    messenger: 'sent_at', votes: 'voting_date',
};

// Three windows: the reported day (d0), the day before (d1), and the SAME
// WEEKDAY a week earlier (d7). Day-over-day alone is misleading on this
// product - Sunday is structurally busier than Saturday, so a Sunday report
// always looks like a collapse against Saturday. Week-over-week is the
// comparison that actually says whether something changed.
async function activity(d0, d1, d7) {
    const out = {};
    for (const [col, f] of Object.entries(FIELDS)) {
        try {
            const [a, b, c] = await Promise.all([
                db.collection(col).where(f, '>=', d0[0]).where(f, '<', d0[1]).count().get(),
                db.collection(col).where(f, '>=', d1[0]).where(f, '<', d1[1]).count().get(),
                db.collection(col).where(f, '>=', d7[0]).where(f, '<', d7[1]).count().get(),
            ]);
            out[col] = { cur: a.data().count, prev: b.data().count, week: c.data().count };
        } catch (e) {
            out[col] = { error: e.message.slice(0, 80) };
        }
    }
    const played = (w) => db.collection('games')
        .where('date', '>=', w[0]).where('date', '<', w[1]).where('status', '==', 'played').count().get();
    const [p0, p1, p7] = await Promise.all([played(d0), played(d1), played(d7)]);
    out.games_played = { cur: p0.data().count, prev: p1.data().count, week: p7.data().count };
    return out;
}

// ------------------------------------------------------------------ errors

function errors(startZ, endZ) {
    const base = `severity>=ERROR AND timestamp>="${startZ}" AND timestamp<"${endZ}"`;
    const count = (filter) => {
        const raw = gcloud(['logging', 'read', filter, `--project=${PROJECT}`,
            '--limit=1000', '--format=value(resource.labels.service_name,resource.labels.function_name)'], ACCOUNT_LOGS);
        return raw.split('\n').filter(l => l.trim()).length;
    };
    const total = count(base);
    const real = count(`${base} AND NOT textPayload:"no available instance"`);

    // Group the real ones by service so the report can name them.
    const rawReal = gcloud(['logging', 'read', `${base} AND NOT textPayload:"no available instance"`,
        `--project=${PROJECT}`, '--limit=500',
        '--format=value(resource.labels.service_name,resource.labels.function_name)'], ACCOUNT_LOGS);
    const byService = {};
    rawReal.split('\n').filter(l => l.trim()).forEach(l => {
        const name = l.split('\t').filter(Boolean)[0] || 'unknown';
        byService[name] = (byService[name] || 0) + 1;
    });

    const indexRaw = gcloud(['logging', 'read',
        `${base} AND (textPayload:"FAILED_PRECONDITION" OR textPayload:"requires an index")`,
        `--project=${PROJECT}`, '--limit=20', '--format=value(textPayload)'], ACCOUNT_LOGS);
    const indexErrors = indexRaw.split('\n').filter(l => l.trim());

    return { total, real, throttled: total - real, byService, indexErrors };
}

// -------------------------------------------------------------- cron health

function crons(asOf) {
    const raw = gcloud(['scheduler', 'jobs', 'list', `--project=${PROJECT}`,
        '--location=europe-west1',
        '--format=value(name.basename(),schedule,lastAttemptTime)'], ACCOUNT_SCHEDULER);
    const rows = raw.split('\n').map(l => l.split('\t')).filter(p => p.length >= 3 && p[2]);

    // A blind check that reports success is worse than no check. If the
    // permission ever regresses, gcloud prints nothing and we would silently
    // claim every cron is healthy.
    if (rows.length === 0) {
        return { error: 'scheduler returned 0 jobs — permission regression? Expected ~12.', jobs: [], stale: [] };
    }

    const stale = [];
    for (const [name, schedule, last] of rows) {
        const ageH = (asOf - new Date(last)) / 3.6e6;
        // Daily-or-slower jobs get a 26h grace; frequent jobs 2h.
        const limit = /every day|^\d+ \d+ \* \* \*/.test(schedule) ? 26 : (/\* \* \*/.test(schedule) ? 2 : 26 * 7);
        if (ageH > limit) stale.push({ name: name.replace('firebase-schedule-', ''), schedule, ageH: Math.round(ageH * 10) / 10 });
    }
    return { jobs: rows, stale };
}

// ------------------------------------------------------------------ horizon

async function horizon() {
    const now = DateTime.now().setZone(TZ);
    const snap = await db.collection('games')
        .where('date', '>=', new Date()).where('status', '==', 'published').get();
    const byDay = {};
    snap.forEach(d => {
        const day = DateTime.fromJSDate(d.data().date.toDate()).setZone(TZ).toISODate();
        byDay[day] = (byDay[day] || 0) + 1;
    });
    // Depth = the last day of CONTIGUOUS coverage, not the furthest game.
    // A single manually-created game far in the future (e.g. one school booking
    // in Québec dated 28 Aug) would otherwise report a healthy horizon while
    // every day before it is empty. Walk forward until the first gap.
    const days = Object.keys(byDay).sort();
    let cursor = now.startOf('day'), last = null;
    for (;;) {
        const iso = cursor.toISODate();
        if (!byDay[iso]) break;
        last = iso;
        cursor = cursor.plus({ days: 1 });
    }
    const depth = last ? Math.round(DateTime.fromISO(last).diff(now.startOf('day'), 'days').days) : 0;

    // Inside the window (D+0..D+20) every day should be well populated.
    const inner = days.filter(d => {
        const n = DateTime.fromISO(d).diff(now.startOf('day'), 'days').days;
        return n >= 0 && n <= 20;
    });
    const thin = inner.filter(d => byDay[d] < 20).map(d => ({ day: d, n: byDay[d] }));

    const reps = await db.collection('repeaters').where('status', '==', 'published').get();
    const malformed = [];
    reps.forEach(d => {
        const r = d.data();
        if (!r.timeZone || !r.weekday || !r.expectedTime) malformed.push({ id: d.id, centre: r.centre });
    });

    return { depth, published: reps.size, malformed, thin, edge: { day: last, n: byDay[last] } };
}

// ------------------------------------------------------------------ deploys

function deploys(sinceISO, untilISO) {
    const repos = ['cloud-functions', 'scripts', 'poteau-app', 'poteau-max'];
    const out = [];
    for (const r of repos) {
        try {
            const log = execFileSync('git', ['-C', `/Users/tmgnr/poteau-workspace/${r}`, 'log',
                `--since=${sinceISO}`, `--until=${untilISO}`, '--oneline'], { encoding: 'utf8' });
            log.split('\n').filter(Boolean).forEach(line => out.push(`${r}: ${line}`));
        } catch (e) { /* not a git repo or no commits */ }
    }
    return out;
}

// ------------------------------------------------------------------- render

// Fixed-width padding so numbers form a column in Slack's proportional font.
// Slack only renders monospace inside a code block, so the activity table is
// emitted as one ``` block rather than as field pairs - field pairs put label
// and value on separate lines and nothing lines up.
function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// Plain numbers, three columns: D-7, D-1, D0. No deltas, no percentages -
// the eye compares the three figures directly and that is enough.
const N = (v) => (v === undefined || v === null) ? '—' : v.toLocaleString();

function row(label, c) {
    if (!c || c.error) return `${pad(label, 16)}${padL('—', 8)}${padL('—', 9)}${padL('—', 9)}`;
    return `${pad(label, 16)}${padL(N(c.week), 8)}${padL(N(c.prev), 9)}${padL(N(c.cur), 9)}`;
}

function build(day, a, e, c, h, dep) {
    // Each warning is: severity dot, bold WHAT, then a plain-language SO WHAT
    // on its own indented line. The consequence is the part worth reading and
    // it should not be buried mid-sentence.
    const attention = [];
    const warn = (dot, what, soWhat) => attention.push(`${dot}  *${what}*\n${' '.repeat(4)}_${soWhat}_`);

    if (c.error) warn('🔴', 'Cron liveness check failed', c.error);
    c.stale.forEach(s => warn('🔴', `${s.name} has not run in ${Math.round(s.ageH)}h`,
        `scheduled ${s.schedule} — whatever it does has silently stopped`));
    if (e.indexErrors.length) warn('🔴', `Firestore index missing (${e.indexErrors.length} hits)`,
        'queries are failing outright — create it from the console URL in the log');
    if (h.depth < 20) warn('🔴', `Game horizon down to ${h.depth} days`,
        'target is 21 — players browsing ahead will hit an empty calendar');
    h.malformed.forEach(m => warn('🟡', `Repeater "${m.centre}" is malformed`,
        'missing weekday or timezone — it generates no games at all'));
    h.thin.forEach(t => warn('🟡', `${DateTime.fromISO(t.day).toFormat('ccc d LLL')} has only ${t.n} games`,
        'unusually thin for a day inside the window'));
    Object.entries(e.byService).sort((x, y) => y[1] - x[1]).forEach(([svc, n]) => {
        if (n >= 5) warn('🟡', `${svc} — ${n} errors`, 'not capacity throttling, so something is actually failing');
    });

    const red = attention.some(x => x.startsWith('🔴'));
    const light = red ? '🔴' : (attention.length ? '🟡' : '🟢');

    // Readability rules applied here:
    //  1. ONE divider only, between "what's wrong" and "the data". More
    //     dividers make every section look equally important.
    //  2. Green is SILENT. No ✅ on healthy lines - ticks next to fine things
    //     compete with the actual warnings for attention.
    //  3. Numbers live in a code block so they form a real column. Slack's
    //     proportional font makes field-pairs impossible to scan.
    //  4. Everything healthy collapses into one dim context line at the bottom.
    const blocks = [];

    // --- headline: the verdict IS the header, not a separate line ---
    const headline = red
        ? `${light} Poteau — incident`
        : (attention.length ? `${light} Poteau — ${attention.length} to look at` : `${light} Poteau — all clear`);
    blocks.push({ type: 'header', text: { type: 'plain_text', text: headline, emoji: true } });
    blocks.push({
        type: 'context', elements: [{
            type: 'mrkdwn',
            text: `${day.toFormat('cccc d LLLL')}  ·  ${e.real} real error${e.real === 1 ? '' : 's'}  ·  ${c.error ? 'cron check failed' : `${c.stale.length} stale cron${c.stale.length === 1 ? '' : 's'}`}  ·  horizon ${h.depth}d`
        }]
    });

    // --- what is wrong: the only thing that gets full-width prose ---
    if (attention.length) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: attention.join('\n\n') } });
    }

    blocks.push({ type: 'divider' });

    // --- the numbers: one monospace table, aligned ---
    // Column headers carry the actual dates so "D-7" is never ambiguous.
    // D-7 is the same weekday, which is the only fair comparison here.
    const head = `${pad('', 16)}${padL('D-7', 8)}${padL('D-1', 9)}${padL('D0', 9)}\n`
        + `${pad('', 16)}${padL(day.minus({ days: 7 }).toFormat('d LLL'), 8)}${padL(day.minus({ days: 1 }).toFormat('d LLL'), 9)}${padL(day.toFormat('d LLL'), 9)}`;
    const table = [
        head,
        '',
        row('games created', a.games),
        row('games played', a.games_played),
        row('users', a.users),
        row('messages', a.messages),
        row('availabilities', a.availabilities),
        row('draft games', a.draft_games),
        row('quiz replies', a.quiz_replies),
        row('payments', a.payments),
    ].join('\n');
    blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Activity*  _D-7 is the same weekday (${day.toFormat('cccc')})_\n\`\`\`\n${table}\n\`\`\`` }
    });

    // --- everything healthy, compressed into dim one-liners ---
    const quiet = [];
    quiet.push(`errors  ${e.total} raw → ${e.real} real  (${e.throttled} throttling)`);
    quiet.push(`crons  ${c.error ? '⚠️ check failed' : `${c.jobs.length - c.stale.length}/${c.jobs.length} on schedule`}`);
    quiet.push(`indexes  ${e.indexErrors.length ? `${e.indexErrors.length} missing` : 'all present'}`);
    quiet.push(`repeaters  ${h.published} published${h.malformed.length ? ` · ${h.malformed.length} malformed` : ''}`);
    quiet.push(`horizon  ${h.depth}d · edge ${DateTime.fromISO(h.edge.day).toFormat('d LLL')} (${h.edge.n})`);
    quiet.push(`low-volume  alerts ${a.alerts ? a.alerts.cur : 0} · votes ${a.votes ? a.votes.cur : 0} · invites ${a.user_invitations ? a.user_invitations.cur : 0} · messenger ${a.messenger ? a.messenger.cur : 0}`);
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: quiet.join('   ·   ') }] });

    if (dep.length) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `*shipped*  ${dep.map(d => '`' + d + '`').join('  ')}` }] });
    }
    return { blocks };
}

// --------------------------------------------------------------------- main

(async () => {
    const target = dateArg
        ? DateTime.fromISO(dateArg, { zone: TZ })
        : DateTime.now().setZone(TZ).minus({ days: 1 });
    const dayStart = target.startOf('day'), dayEnd = target.endOf('day');

    const d0 = [dayStart.toJSDate(), dayEnd.toJSDate()];
    const d1 = [dayStart.minus({ days: 1 }).toJSDate(), dayStart.toJSDate()];
    const d7 = [dayStart.minus({ days: 7 }).toJSDate(), dayStart.minus({ days: 6 }).toJSDate()];

    const a = await activity(d0, d1, d7);
    const e = errors(dayStart.toUTC().toISO(), dayEnd.toUTC().toISO());
    const c = crons(dayEnd.toJSDate());
    const h = await horizon();
    const dep = deploys(dayStart.toISODate(), dayEnd.toISODate());

    const payload = build(target, a, e, c, h, dep);

    if (DRY) {
        console.log(JSON.stringify(payload, null, 1));
        process.exit(0);
    }

    const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
    const url = (env.match(/SLACK_WEBHOOK_URL="([^"]+)"/) || [])[1];
    if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);

    const res = execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json',
        '--data', JSON.stringify(payload), url], { encoding: 'utf8' });
    console.log('slack:', res);
    process.exit(0);
})().catch(e => { console.error('REPORT FAILED:', e); process.exit(1); });
