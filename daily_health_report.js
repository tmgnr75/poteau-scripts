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

// One identity for everything. The admin SA was granted
// roles/cloudscheduler.viewer on 2026-08-04, so it now reads both logs and
// scheduler jobs. Before that the cron check needed tim@poteau.team, whose
// user OAuth token expired and killed the 08:30 run - launchd has no browser
// to reauthenticate with. Service-account keys do not expire, so this must
// stay a service account: do NOT point either constant at a user account.
const ACCOUNT_LOGS = 'firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com';
const ACCOUNT_SCHEDULER = ACCOUNT_LOGS;

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
    // "Real" must use the SAME exclusions as the per-service breakdown below,
    // or the headline claims N real errors while listing none of them.
    const realFilter = `${base} AND NOT textPayload:"no available instance" AND NOT httpRequest.userAgent:"axios"`;
    const real = count(realFilter);

    // Group the real ones by service so the report can name them.
    //
    // Exclude requests made by axios: the Flutter apps use Dart's http client,
    // and no Cloud Function calls these endpoints internally, so an axios user
    // agent is a human running probes from a laptop - i.e. us, debugging.
    // On 2026-08-03 an investigation produced a 104-error burst that the report
    // then presented as a production incident affecting users. Own traffic must
    // never masquerade as a user-facing failure.
    const rawReal = gcloud(['logging', 'read',
        `${base} AND NOT textPayload:"no available instance" AND NOT httpRequest.userAgent:"axios"`,
        `--project=${PROJECT}`, '--limit=500',
        '--format=value(resource.labels.service_name,resource.labels.function_name)'], ACCOUNT_LOGS);
    const byService = {};
    rawReal.split('\n').filter(l => l.trim()).forEach(l => {
        const name = l.split('\t').filter(Boolean)[0] || 'unknown';
        byService[name] = (byService[name] || 0) + 1;
    });

    // One concrete sample per offending service, so the finding can say what
    // actually went wrong instead of telling the reader to go dig.
    const samples = {};
    for (const svc of Object.keys(byService)) {
        if (svc === 'unknown') continue;
        try {
            const raw = gcloud(['logging', 'read',
                `${base} AND resource.labels.service_name="${svc}" AND NOT textPayload:"no available instance" AND NOT httpRequest.userAgent:"axios"`,
                `--project=${PROJECT}`, '--limit=1',
                '--format=value(textPayload,httpRequest.status,httpRequest.requestUrl)'], ACCOUNT_LOGS).trim();
            if (!raw) continue;
            const [txt, status, url] = raw.split('\t');
            if (txt && txt !== 'null') {
                samples[svc] = txt.split('\n')[0].slice(0, 140);
            } else if (status) {
                const path = (url || '').split('?')[0].split('/').pop();
                samples[svc] = `HTTP ${status} on ${path || svc}`;
            }
        } catch (err) { /* sampling is best-effort */ }
    }

    const indexRaw = gcloud(['logging', 'read',
        `${base} AND (textPayload:"FAILED_PRECONDITION" OR textPayload:"requires an index")`,
        `--project=${PROJECT}`, '--limit=20', '--format=value(textPayload)'], ACCOUNT_LOGS);
    const indexErrors = indexRaw.split('\n').filter(l => l.trim());

    return { total, real, throttled: total - real, byService, indexErrors, samples };
}

// -------------------------------------------------------------- cron health

function crons(asOf) {
    // Listing scheduler jobs needs a USER account (the admin SA lacks
    // cloudscheduler.jobs.list). User OAuth tokens expire and cannot be
    // refreshed from launchd - there is no browser to prompt. When that
    // happens, degrade to a warning instead of killing the whole report:
    // losing one check is bad, losing the entire morning report is worse.
    let raw;
    try {
        raw = gcloud(['scheduler', 'jobs', 'list', `--project=${PROJECT}`,
            '--location=europe-west1',
            '--format=value(name.basename(),schedule,lastAttemptTime)'], ACCOUNT_SCHEDULER);
    } catch (err) {
        const msg = String(err.stderr || err.message || '');
        const expired = /Reauthentication failed|auth tokens|gcloud auth login/i.test(msg);
        return {
            error: expired
                ? `gcloud auth for ${ACCOUNT_SCHEDULER} has expired — run \`gcloud auth login\` in a terminal`
                : msg.split('\n')[0].slice(0, 160),
            jobs: [], stale: [],
        };
    } finally {
        // Always hand the account back, or every later gcloud call in this
        // process inherits the broken user account.
        try { execFileSync('gcloud', ['config', 'set', 'core/account', ACCOUNT_LOGS], { stdio: 'pipe' }); } catch (e) { /* best effort */ }
    }
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
    // Start the walk at the first day that HAS games, not at today. Late in
    // the evening every game today has already kicked off, so "today" holds no
    // future published games and a walk anchored there would break immediately
    // and report a 0-day horizon every night. Only today and tomorrow are
    // allowed as start points - a gap any wider than that is a real outage.
    const days = Object.keys(byDay).sort();
    const today = now.startOf('day');
    let cursor = null;
    for (const cand of [today, today.plus({ days: 1 })]) {
        if (byDay[cand.toISODate()]) { cursor = cand; break; }
    }
    let last = null;
    if (cursor) {
        for (;;) {
            const iso = cursor.toISODate();
            if (!byDay[iso]) break;
            last = iso;
            cursor = cursor.plus({ days: 1 });
        }
    }
    const depth = last ? Math.round(DateTime.fromISO(last).diff(today, 'days').days) : 0;

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
    // Every finding carries a recommendation. An amber dot with no next step
    // is just anxiety - the reader cannot tell whether to act or ignore it.
    const attention = [];
    const warn = (dot, what, soWhat, doWhat) => attention.push({ dot, what, soWhat, doWhat });

    if (c.error) warn('🔴', 'Cron liveness check failed', c.error,
        'the report is blind to stale crons until this is fixed — check gcloud auth');
    c.stale.forEach(s => warn('🔴', `${s.name} has not run in ${Math.round(s.ageH)}h`,
        `scheduled ${s.schedule} — whatever it does has silently stopped`,
        'check Cloud Scheduler in the console, then trigger it manually'));
    if (e.indexErrors.length) warn('🔴', `Firestore index missing (${e.indexErrors.length} hits)`,
        'queries are failing outright, so a feature is broken right now',
        'create it from the console URL in the log — takes one click, builds in minutes');
    if (h.depth < 20) warn('🔴', `Game horizon down to ${h.depth} days`,
        'target is 21 — players browsing ahead hit an empty calendar',
        'check scheduleGames ran; if it did, run the backfill in scripts/');
    h.malformed.forEach(m => warn('🟡', `Repeater "${m.centre}" is malformed`,
        'missing weekday or timezone, so it generates no games at all',
        'infer the weekday from its recent games and set it, or pause the repeater'));
    h.thin.forEach(t => warn('🟡', `${DateTime.fromISO(t.day).toFormat('ccc d LLL')} has only ${t.n} games`,
        'unusually thin for a day inside the window',
        'if it stays thin tomorrow, check whether centres paused their repeaters'));
    Object.entries(e.byService).sort((x, y) => y[1] - x[1]).forEach(([svc, n]) => {
        if (n < 5) return;
        const known = {
            getplacedetails: ['Google Places API rate limit', 'raise the quota or add caching — place lookups are silently failing for users'],
            unreservespots: ['Remote Config read quota exceeded', 'behaviour is correct (falls back to the 120h default) — cache the RC read to silence it'],
        }[svc];
        // The generic fallback must still say WHAT failed. "Go read the log"
        // is the vague, unactionable line this report exists to avoid, so pull
        // one real sample and quote it.
        const sample = known ? null : e.samples[svc];
        warn('🟡', `${svc} — ${n} errors`,
            known ? known[0] : (sample || 'not capacity throttling, so something is genuinely failing'),
            known ? known[1] : `check whether this affects users — ${n} failures in one day is a real rate`);
    });

    const red = attention.some(x => x.dot === '🔴');
    const light = red ? '🔴' : (attention.length ? '🟡' : '🟢');

    // --- summary: two or three sentences judging the day against D-7 ---
    // A table cannot say "quiet Sunday, nothing unusual", and on a phone that
    // sentence is often the only thing actually read.
    const swing = (c) => (!c || c.error || !c.week) ? 0 : Math.round(((c.cur - c.week) / c.week) * 100);
    const notable = [
        ['games created', swing(a.games)], ['games played', swing(a.games_played)],
        ['signups', swing(a.users)], ['messages', swing(a.messages)],
        ['availabilities', swing(a.availabilities)], ['payments', swing(a.payments)],
    ].filter(([, p]) => Math.abs(p) >= 25).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]));

    const sentences = [];
    const wd = day.toFormat('cccc');
    if (!notable.length) {
        sentences.push(`Activity was in line with last ${wd} across the board.`);
    } else {
        const phr = notable.slice(0, 3).map(([k, p]) => `*${k}* ${p > 0 ? 'up' : 'down'} ${Math.abs(p)}%`);
        sentences.push(`Against last ${wd}: ${phr.join(', ')}.`);
        if (notable.length > 3) sentences.push(`${notable.length - 3} other metric(s) also moved more than 25%.`);
    }
    if (red) {
        sentences.push(`*Something is broken and needs attention today* — see below.`);
    } else if (attention.length) {
        sentences.push(`Nothing is broken; ${attention.length} item${attention.length === 1 ? '' : 's'} worth a decision when convenient.`);
    } else {
        sentences.push(`No errors beyond normal capacity throttling, all crons on schedule, game horizon healthy.`);
    }
    const summary = sentences.join(' ');

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

    // --- summary: how the day went, in plain sentences ---
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: summary } });

    // --- what is wrong, each with a recommendation ---
    if (attention.length) {
        const order = { '🔴': 0, '🟡': 1, '🟢': 2 };
        const text = attention.slice().sort((x, y) => order[x.dot] - order[y.dot])
            .map(f => {
                let s = `${f.dot}  *${f.what}*`;
                if (f.soWhat) s += `\n_${f.soWhat}_`;
                if (f.doWhat) s += `\n→  ${f.doWhat}`;
                return s;
            }).join('\n\n');
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
    }

    blocks.push({ type: 'divider' });

    // --- the numbers: one monospace table, aligned ---
    // MOBILE: every line must stay <= 32 chars or Slack's phone code block
    // wraps and the columns stop lining up. 12 + 3x6 = 30. Labels truncate.
    const LW = 12, CW = 6;
    const cell = (v) => padL(v === undefined || v === null ? '—' :
        (typeof v === 'number' && v >= 10000 ? Math.round(v / 1000) + 'k' : v.toLocaleString()), CW);
    const trow = (label, c) => pad(label.length > LW - 1 ? label.slice(0, LW - 2) + '…' : label, LW)
        + (!c || c.error ? cell('—') + cell('—') + cell('—') : cell(c.week) + cell(c.prev) + cell(c.cur));

    const table = [
        pad('', LW) + padL('D-7', CW) + padL('D-1', CW) + padL('D0', CW),
        trow('games new', a.games),
        trow('games played', a.games_played),
        trow('users', a.users),
        trow('messages', a.messages),
        trow('availabil.', a.availabilities),
        trow('drafts', a.draft_games),
        trow('quiz', a.quiz_replies),
        trow('payments', a.payments),
    ].join('\n');
    blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Activity*  _D-7 = last ${day.toFormat('cccc')}_\n\`\`\`\n${table}\n\`\`\`` }
    });

    // --- everything healthy, compressed into dim one-liners ---
    // Short phrases: this wraps naturally on a phone instead of forming one
    // long unreadable line.
    const quiet = [
        `${e.real} real errors of ${e.total}`,
        `crons ${c.error ? '⚠️ check failed' : `${c.jobs.length - c.stale.length}/${c.jobs.length}`}`,
        `indexes ${e.indexErrors.length ? `${e.indexErrors.length} missing` : 'ok'}`,
        `horizon ${h.depth}d`,
        `${h.published} repeaters`,
    ];
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: quiet.join('  ·  ') }] });

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
})().catch(e => {
    // A silent failure is the worst outcome: the report simply does not
    // arrive and nobody knows whether production is fine or the monitor is
    // dead. On 2026-08-04 an expired gcloud token killed the 08:30 run and it
    // looked identical to "nothing happened". Always post something.
    console.error('REPORT FAILED:', e);
    try {
        const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
        const url = (env.match(/SLACK_WEBHOOK_URL="([^"]+)"/) || [])[1];
        if (url) {
            const msg = String(e && (e.stderr || e.message) || e).split('\n')[0].slice(0, 300);
            execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json',
                '--data', JSON.stringify({
                    blocks: [
                        { type: 'header', text: { type: 'plain_text', text: '⚠️ Poteau — health report failed to run', emoji: true } },
                        { type: 'section', text: { type: 'mrkdwn', text: `The monitor itself broke, so *production status is unknown this morning*.\n\`\`\`${msg}\`\`\`` } },
                        { type: 'context', elements: [{ type: 'mrkdwn', text: 'check `~/.poteau/health_report.err` on the Mac' }] },
                    ]
                }), url], { encoding: 'utf8' });
        }
    } catch (postErr) { console.error('could not post failure notice:', postErr.message); }
    process.exit(1);
});
