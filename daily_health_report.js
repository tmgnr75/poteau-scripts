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

async function activity(d1, d2) {
    const out = {};
    for (const [col, f] of Object.entries(FIELDS)) {
        try {
            const [a, b] = await Promise.all([
                db.collection(col).where(f, '>=', d1[0]).where(f, '<', d1[1]).count().get(),
                db.collection(col).where(f, '>=', d2[0]).where(f, '<', d2[1]).count().get(),
            ]);
            out[col] = { cur: a.data().count, prev: b.data().count };
        } catch (e) {
            out[col] = { error: e.message.slice(0, 80) };
        }
    }
    const [p1, p2] = await Promise.all([
        db.collection('games').where('date', '>=', d1[0]).where('date', '<', d1[1]).where('status', '==', 'played').count().get(),
        db.collection('games').where('date', '>=', d2[0]).where('date', '<', d2[1]).where('status', '==', 'played').count().get(),
    ]);
    out.games_played = { cur: p1.data().count, prev: p2.data().count };
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

function delta(c) {
    if (!c || c.error) return '—';
    const d = c.cur - c.prev;
    const sign = d > 0 ? `+${d}` : (d < 0 ? `${d}` : '=');
    return `${c.cur.toLocaleString()}  (${sign})`;
}

function build(day, a, e, c, h, dep) {
    const attention = [];
    if (c.error) attention.push(`🔴 *Cron check FAILED* — ${c.error}`);
    c.stale.forEach(s => attention.push(`🔴 *\`${s.name}\` has not run in ${s.ageH}h* (schedule: ${s.schedule})`));
    if (e.indexErrors.length) attention.push(`🔴 *Missing Firestore index* — ${e.indexErrors.length} occurrences. Create it from the URL in the log.`);
    h.malformed.forEach(m => attention.push(`🟡 *Malformed repeater* \`${m.centre}\` (${m.id}) — missing weekday/timezone, generating nothing`));
    if (h.depth < 20) attention.push(`🔴 *Game horizon down to ${h.depth} days* (target 21)`);
    h.thin.forEach(t => attention.push(`🟡 *${t.day} has only ${t.n} games* — unusually thin inside the window`));
    Object.entries(e.byService).forEach(([svc, n]) => {
        if (n >= 5) attention.push(`🟡 *\`${svc}\` — ${n} real errors*`);
    });

    const red = attention.some(x => x.startsWith('🔴'));
    const light = red ? '🔴' : (attention.length ? '🟡' : '🟢');
    const verdict = red ? 'incident.' : (attention.length ? 'normal, some things to look at.' : 'all clear.');

    const blocks = [
        { type: 'header', text: { type: 'plain_text', text: `${light} Poteau daily health — ${day.toFormat('ccc d LLL')}`, emoji: true } },
        { type: 'section', text: { type: 'mrkdwn', text: `*VERDICT: ${verdict}*` } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*── needs attention ──*' } },
        { type: 'section', text: { type: 'mrkdwn', text: attention.length ? attention.join('\n') : '_(nothing)_' } },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*── activity (vs day before) ──*' } },
        {
            type: 'section', fields: [
                { type: 'mrkdwn', text: `*games created*\n${delta(a.games)}` },
                { type: 'mrkdwn', text: `*games played*\n${delta(a.games_played)}` },
                { type: 'mrkdwn', text: `*users signed up*\n${delta(a.users)}` },
                { type: 'mrkdwn', text: `*messages*\n${delta(a.messages)}` },
                { type: 'mrkdwn', text: `*availabilities*\n${delta(a.availabilities)}` },
                { type: 'mrkdwn', text: `*draft games*\n${delta(a.draft_games)}` },
                { type: 'mrkdwn', text: `*quiz replies*\n${delta(a.quiz_replies)}` },
                { type: 'mrkdwn', text: `*payments*\n${delta(a.payments)}` },
            ]
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: `alerts ${delta(a.alerts)} · votes ${delta(a.votes)} · invites ${delta(a.user_invitations)} · messenger ${delta(a.messenger)} — \`connect\`/\`game_invitations\` ≈600k/day each, normal fan-out` }] },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*── reliability ──*' } },
        {
            type: 'section', text: {
                type: 'mrkdwn', text: [
                    `• *errors* ${e.total} raw → *${e.real} real* (${e.throttled} capacity throttling, benign)`,
                    `• *indexes* ${e.indexErrors.length ? `${e.indexErrors.length} missing 🔴` : 'none missing ✅'}`,
                    `• *crons* ${c.error ? 'CHECK FAILED 🔴' : `${c.jobs.length - c.stale.length}/${c.jobs.length} fired on schedule${c.stale.length ? ` — *${c.stale.length} stale*` : ' ✅'}`}`,
                    `• *deploys* ${dep.length ? `${dep.length} commit(s)` : 'none'}`,
                ].join('\n')
            }
        },
        { type: 'divider' },
        { type: 'section', text: { type: 'mrkdwn', text: '*── recurring games ──*' } },
        {
            type: 'section', text: {
                type: 'mrkdwn', text: [
                    `• *horizon* ${h.depth} days ${h.depth >= 20 ? '✅' : '🔴'}`,
                    `• *edge day* ${h.edge.day} (${h.edge.n} games) — newest day is thin by design`,
                    `• *repeaters* ${h.published} published · ${h.malformed.length} malformed`,
                ].join('\n')
            }
        },
    ];

    if (dep.length) {
        blocks.push({ type: 'divider' });
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*── shipped ──*\n${dep.map(d => '`' + d + '`').join('\n')}` } });
    }
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: `report for ${day.toISODate()} · generated ${DateTime.now().setZone(TZ).toFormat('yyyy-LL-dd HH:mm')} Paris` }] });
    return { blocks };
}

// --------------------------------------------------------------------- main

(async () => {
    const target = dateArg
        ? DateTime.fromISO(dateArg, { zone: TZ })
        : DateTime.now().setZone(TZ).minus({ days: 1 });
    const dayStart = target.startOf('day'), dayEnd = target.endOf('day');
    const prevStart = dayStart.minus({ days: 1 }), prevEnd = dayStart;

    const d1 = [dayStart.toJSDate(), dayEnd.toJSDate()];
    const d2 = [prevStart.toJSDate(), prevEnd.toJSDate()];

    const a = await activity(d1, d2);
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
