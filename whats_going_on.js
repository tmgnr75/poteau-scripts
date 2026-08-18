#!/usr/bin/env node
/**
 * "What's going on in production right now?"
 *
 * An on-demand narrative of live activity over a rolling window. This is the
 * complement to daily_health_report.js, not a replacement:
 *
 *   daily_health_report.js   scheduled, yesterday, INFRASTRUCTURE
 *                            (errors, crons, deploys, game horizon)
 *   whats_going_on.js        on demand, rolling window, ACTIVITY
 *                            (what people did, and what failed them)
 *
 * The daily report answers "is anything broken". This answers "what is
 * happening", which is a different question: 381 games created is not an
 * error, but it is the thing you actually want to see.
 *
 * DESIGN RULE: report what a number MEANS, not just the number. A count with
 * no baseline cannot be acted on — every headline metric is therefore printed
 * against the preceding window of equal length, so "381 games" reads as
 * "381 games, +4% vs the previous 48h" and a collapse is visible instantly.
 *
 * Usage:
 *   node whats_going_on.js               # last 48h
 *   node whats_going_on.js --hours=6     # any window
 *   node whats_going_on.js --slack       # also post to #health-reports
 *   node whats_going_on.js --slack --dry # print the Slack payload, post nothing
 *   node whats_going_on.js --no-logs     # skip Cloud Logging (fast, Firestore only)
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

// scripts/ has no node_modules of its own; the functions repo's copy is the
// one that resolves. Same fallback the health report uses.
function dep(name) {
    try { return require(name); }
    catch (e) { return require(`/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/${name}`); }
}
const admin = dep('firebase-admin');

const SA_PATH = '/Users/tmgnr/poteau-workspace/scripts/krank-club-firebase-adminsdk-bl4zy-d8facdf022.json';
const PROJECT = 'krank-club';
// Service-account only. A user OAuth token expires silently and takes the
// whole run with it. See memory: gcloud auth expires silently.
const ACCOUNT = 'firebase-adminsdk-bl4zy@krank-club.iam.gserviceaccount.com';
const WEBHOOK_ENV = `${process.env.HOME}/.poteau/slack_webhook.env`;

const arg = (k, d) => {
    const v = process.argv.find(a => a.startsWith(`--${k}=`));
    return v ? v.split('=')[1] : d;
};
const HOURS = Number(arg('hours', 48));
const SLACK = process.argv.includes('--slack');
const NO_LOGS = process.argv.includes('--no-logs');
const DRY = process.argv.includes('--dry');   // build the Slack payload, post nothing

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
}
const db = admin.firestore();

const now = Date.now();
const T0 = new Date(now - HOURS * 3600e3);          // window start
const TP = new Date(now - 2 * HOURS * 3600e3);      // previous window start

const N = (v) => typeof v === 'number' ? v.toLocaleString('en-US') : String(v);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
const padL = (s, n) => ' '.repeat(Math.max(0, n - String(s).length)) + String(s);

/** Percent change vs the previous window, as a readable delta. */
function delta(cur, prev) {
    if (prev === 0) return cur === 0 ? 'flat' : 'new';
    const p = Math.round(((cur - prev) / prev) * 100);
    if (Math.abs(p) < 5) return 'flat';
    return (p > 0 ? '+' : '') + p + '%';
}

// ------------------------------------------------------------------ volumes

// Each collection carries its own timestamp field name. Getting one wrong
// yields a silent zero rather than an error, so they are declared explicitly
// and anything that fails is surfaced as ERR rather than swallowed.
const FIELDS = {
    games: 'created_on',
    users: 'created_time',
    messages: 'created',
    game_invitations: 'created',
    connect: 'datetime',
    payments: 'authorization_date',
    availabilities: 'created_at',
    draft_games: 'created_on',
    quiz_replies: 'created_at',
};

async function volumes() {
    const out = {};
    await Promise.all(Object.entries(FIELDS).map(async ([col, f]) => {
        try {
            const [a, b] = await Promise.all([
                db.collection(col).where(f, '>=', T0).count().get(),
                db.collection(col).where(f, '>=', TP).where(f, '<', T0).count().get(),
            ]);
            out[col] = { cur: a.data().count, prev: b.data().count };
        } catch (e) {
            out[col] = { error: e.message.slice(0, 70) };
        }
    }));
    return out;
}

// -------------------------------------------------------------------- games

/**
 * Games are read in full rather than counted, because the interesting part is
 * the breakdown: an empty game and a full one both count as "1 created".
 */
async function games() {
    const snap = await db.collection('games').where('created_on', '>=', T0).get();
    const bySport = {}, byStatus = {}, byCentre = {};
    let empty = 0, withPlayers = 0, cancelled = 0;
    snap.forEach(d => {
        const g = d.data();
        bySport[g.sport || '—'] = (bySport[g.sport || '—'] || 0) + 1;
        byStatus[g.status || '—'] = (byStatus[g.status || '—'] || 0) + 1;
        if (g.centre) byCentre[g.centre] = (byCentre[g.centre] || 0) + 1;
        // Dedupe: a +1 guest is the SAME user ref pushed twice, so a raw
        // length over-counts. See FIRESTORE_ANALYTICS_GUIDE.md §2.
        const ids = new Set((g.attendees || [])
            .filter(r => r && r.parent && r.parent.id === 'users').map(r => r.id));
        if (ids.size === 0) empty++; else withPlayers++;
        if (g.status === 'canceled' || g.status === 'hidden') cancelled++;
    });
    return {
        total: snap.size, bySport, byStatus, empty, withPlayers, cancelled,
        topCentres: Object.entries(byCentre).sort((a, b) => b[1] - a[1]).slice(0, 6),
    };
}

// ----------------------------------------------------------------- messages

/**
 * `log` messages are system-generated chat lines (joins, removals); `message`
 * is a human typing. Only the second is a sign of life, so they must never be
 * reported as one number.
 */
async function messages() {
    const snap = await db.collection('messages').where('created', '>=', T0).get();
    const byType = {};
    const games = new Set();
    snap.forEach(d => {
        const m = d.data();
        byType[m.type || '—'] = (byType[m.type || '—'] || 0) + 1;
        if (m.game_id) games.add(m.game_id.id);
    });
    return { total: snap.size, byType, activeGames: games.size };
}

// -------------------------------------------------------------- moderation

/** Anything a human should look at: new bans, reports, support messages. */
async function support() {
    const out = {};
    try {
        const s = await db.collection('messages')
            .where('created', '>=', T0).where('type', '==', 'poteau_team_message').get();
        out.teamMessages = s.size;
    } catch (e) { out.teamMessages = 'ERR'; }
    try {
        const s = await db.collection('users').where('banned', '==', true).count().get();
        out.bannedTotal = s.data().count;
    } catch (e) { out.bannedTotal = 'ERR'; }
    return out;
}

// ---------------------------------------------------------------- payments

/**
 * Payment health is a funnel, not a count. Attempts that never reach
 * `captured` are the number that matters — and per memory, abandonment at the
 * PaymentSheet is normal user behaviour, NOT a bug, so it is labelled as such
 * rather than alarmed on.
 */
async function payments() {
    const snap = await db.collection('payments').where('authorization_date', '>=', T0).get();
    const byStatus = {};
    let amount = 0;
    snap.forEach(d => {
        const p = d.data();
        byStatus[p.status || '—'] = (byStatus[p.status || '—'] || 0) + 1;
        if (p.status === 'captured' || p.status === 'succeeded') amount += Number(p.amount || 0);
    });
    return { total: snap.size, byStatus, captured: amount };
}

// ------------------------------------------------------------------- logs

function gcloud(args) {
    execFileSync('gcloud', ['config', 'set', 'core/account', ACCOUNT], { stdio: 'pipe' });
    return execFileSync('gcloud', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/**
 * Cloud Function errors, split into real faults and known-benign noise.
 *
 * "no available instance" is Cloud Run shedding load under a burst. It is
 * capacity, not a bug, and it dominates by volume — roughly 978 of every 1000
 * errors. Reporting it undifferentiated buries the three that matter, which is
 * exactly the failure mode this script exists to avoid.
 */
function cfErrors() {
    const since = new Date(now - HOURS * 3600e3).toISOString();
    const raw = gcloud(['logging', 'read',
        `resource.type=("cloud_function" OR "cloud_run_revision") AND severity>=ERROR AND timestamp>="${since}"`,
        `--project=${PROJECT}`, '--format=value(resource.labels.function_name,resource.labels.service_name,jsonPayload.message,jsonPayload.error,textPayload)',
        '--limit=3000']);
    const lines = raw.split('\n').filter(Boolean);
    let throttle = 0;
    const bySvc = {}, samples = {};
    for (const line of lines) {
        if (/no available instance/.test(line)) { throttle++; continue; }
        // A multi-line stack trace arrives as several log lines, and only the
        // FIRST is a real record. gcloud emits one tab per requested field, so
        // a genuine row always contains tabs; the continuations ("    at ...",
        // "  code: '...'", a bare "}") carry none. Keying on tabs rather than
        // on leading whitespace matters: real rows begin WITH a tab, because
        // the first column (function_name) is empty for Cloud Run services.
        if (!line.includes('\t')) continue;
        const cols = line.split('\t');
        const svc = (cols.find(c => c && c.trim()) || 'unknown').trim();
        if (!/^[a-z][a-z0-9_-]*$/i.test(svc)) continue;   // not a service name
        bySvc[svc] = (bySvc[svc] || 0) + 1;
        if (!samples[svc]) {
            // Skip the leading service-name columns; keep the first column
            // that says something the service name did not.
            const msg = cols.filter(c => c && c.trim() && c.trim() !== svc)
                .join(' ').replace(/\s+/g, ' ').trim();
            if (msg) samples[svc] = msg.slice(0, 150);
        }
    }
    return { total: lines.length, throttle, real: lines.length - throttle, bySvc, samples };
}

/** Push delivery, counted from log lines rather than inferred from errors. */
function pushHealth() {
    const raw = gcloud(['logging', 'read',
        `resource.labels.function_name="sendPushNotification"`,
        `--project=${PROJECT}`, '--format=value(textPayload)',
        `--freshness=${HOURS}h`, '--limit=5000']);
    const c = (re) => (raw.match(re) || []).length;
    return {
        delivered: c(/Push succeeded/g),
        failedToken: c(/Push failed for token/g),
        failedAll: c(/Push failed for all tokens/g),
        noTokens: c(/No FCM tokens available/g),
        emails: c(/Email sent|Fallback email published/g),
        crashes: c(/TypeError|ReferenceError|is not a function|Cannot read/g),
    };
}

// ------------------------------------------------------------------ render

function render(d) {
    const L = [];
    const w = `${HOURS}h`;
    L.push(`PRODUCTION · last ${w} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}Z`);
    L.push('='.repeat(60));

    // headline
    const v = d.vol;
    const line = (label, key) => {
        const c = v[key];
        if (!c) return;
        if (c.error) return L.push(`  ${pad(label, 18)} ERR ${c.error}`);
        L.push(`  ${pad(label, 18)}${padL(N(c.cur), 9)}   ${delta(c.cur, c.prev)} vs prev ${w}`);
    };
    L.push('\nACTIVITY');
    line('games created', 'games');
    line('new users', 'users');
    line('messages', 'messages');
    line('availabilities', 'availabilities');
    line('drafts', 'draft_games');
    line('quiz replies', 'quiz_replies');
    line('payments', 'payments');
    line('invitations', 'game_invitations');
    line('notifications', 'connect');

    // games
    const g = d.games;
    L.push(`\nGAMES (${N(g.total)} created)`);
    L.push(`  sport            ${Object.entries(g.bySport).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    L.push(`  status           ${Object.entries(g.byStatus).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
    const fillPct = g.total ? Math.round((g.withPlayers / g.total) * 100) : 0;
    L.push(`  got a player     ${g.withPlayers}/${g.total} (${fillPct}%)   still empty: ${g.empty}`);
    L.push(`  top centres      ${g.topCentres.map(([k, n]) => `${k} (${n})`).join(', ')}`);

    // chat
    const m = d.msg;
    L.push(`\nCHAT`);
    L.push(`  human messages   ${N(m.byType.message || 0)} across ${N(m.activeGames)} games`);
    L.push(`  system log lines ${N(m.byType.log || 0)}`);
    if (d.sup.teamMessages) L.push(`  team messages    ${N(d.sup.teamMessages)}`);

    // payments
    const p = d.pay;
    L.push(`\nPAYMENTS (${N(p.total)} attempts)`);
    L.push(`  ${Object.entries(p.byStatus).map(([k, n]) => `${k} ${n}`).join(' · ') || 'none'}`);
    if (p.total) {
        L.push(`  note             abandonment at the PaymentSheet is normal, not a fault`);
    }

    // delivery + errors
    if (d.push) {
        const ph = d.push;
        L.push(`\nPUSH`);
        L.push(`  delivered ${N(ph.delivered)} · failed ${N(ph.failedToken)} · no tokens ${N(ph.noTokens)} · fallback emails ${N(ph.emails)}`);
        if (ph.crashes) L.push(`  !! ${ph.crashes} JS error(s) in the push path — investigate first`);
    }
    if (d.err) {
        const e = d.err;
        L.push(`\nERRORS (${N(e.total)} total)`);
        L.push(`  ${N(e.throttle)} capacity throttling (benign) · ${N(e.real)} other`);
        const rest = Object.entries(e.bySvc).sort((a, b) => b[1] - a[1]).slice(0, 8);
        for (const [svc, n] of rest) {
            L.push(`   · ${pad(svc, 26)} ${padL(n, 4)}   ${e.samples[svc] ? e.samples[svc].slice(0, 90) : ''}`);
        }
    }
    L.push('');
    return L.join('\n');
}

/**
 * The webhook is bound to #health-reports (app "Claude", added 2026-08-03).
 * The channel is a property of the webhook, not of the payload, so there is
 * nothing to route here — but read the key the same way every other report
 * does, so one env file keeps working for all of them.
 */
function slackWebhookUrl() {
    const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
    const url = (env.match(/SLACK_WEBHOOK_URL=["']?([^"'\n]+)/) || [])[1];
    if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);
    return url;
}

function post(payload) {
    // curl, matching daily_health_report.js: that path has posted unattended
    // from launchd since 2026-08-03 and there is no reason to re-prove another.
    execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json',
        '--data', JSON.stringify(payload), slackWebhookUrl()], { encoding: 'utf8' });
}

/**
 * Build the Slack message.
 *
 * Not the same layout as the terminal. On a phone, a 60-column table wraps and
 * becomes unreadable, so the headline numbers go in a narrow code block (the
 * <=32 char rule the daily report established) and everything a human should
 * ACT on is lifted out above it as prose. A reader who opens this on their
 * phone should learn whether anything needs them without scrolling.
 */
function slackPayload(d) {
    const w = `${HOURS}h`;
    const v = d.vol, g = d.games, p = d.pay;

    // What needs a human. Order matters: a blocked user beats a slow endpoint.
    const attention = [];
    if (d.push && d.push.crashes) {
        attention.push(`🔴  *${d.push.crashes} JS error${d.push.crashes === 1 ? '' : 's'} in the push path* — players are not being told about their games`);
    }
    if (d.err) {
        for (const [svc, n] of Object.entries(d.err.bySvc).sort((a, b) => b[1] - a[1]).slice(0, 4)) {
            const sample = (d.err.samples[svc] || '').replace(/`/g, "'").slice(0, 120);
            attention.push(`🟠  *${svc}* — ${n} error${n === 1 ? '' : 's'}${sample ? `\n_${sample}_` : ''}`);
        }
    }
    const emptyPct = g.total ? Math.round((g.empty / g.total) * 100) : 0;
    if (emptyPct >= 40) {
        attention.push(`🟡  *${emptyPct}% of new games have no players yet* (${g.empty} of ${g.total}) — normal for Poteau, watch the trend not the number`);
    }

    const blocks = [{
        type: 'header',
        text: { type: 'plain_text', text: `Production · last ${w}`, emoji: true },
    }, {
        type: 'context',
        elements: [{
            type: 'mrkdwn',
            text: `${N(g.total)} games  ·  ${N((v.users || {}).cur || 0)} new users  ·  ${N((d.msg.byType || {}).message || 0)} messages  ·  ${d.err ? `${N(d.err.real)} real error${d.err.real === 1 ? '' : 's'}` : 'errors not checked'}`,
        }],
    }];

    if (attention.length) {
        blocks.push({ type: 'divider' });
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: attention.join('\n\n') } });
    }

    blocks.push({ type: 'divider' });

    // Narrow table: 14 + 8 + 8 = 30 chars, under Slack's mobile wrap point.
    const LW = 14, CW = 8;
    // Abbreviate hard: the invitation fanout runs into the millions and
    // "1164k" is harder to read than "1.2M" at a glance.
    const abbrev = (n) => {
        if (typeof n !== 'number') return N(n);
        if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 10e3) return Math.round(n / 1e3) + 'k';
        return N(n);
    };
    const cell = (n) => padL(abbrev(n), CW);
    const trow = (label, key) => {
        const c = v[key];
        if (!c || c.error) return pad(label, LW) + cell('—') + cell('—');
        return pad(label, LW) + cell(c.cur) + padL(delta(c.cur, c.prev), CW);
    };
    const table = [
        pad('', LW) + padL('now', CW) + padL('vs prev', CW),
        trow('games', 'games'),
        trow('new users', 'users'),
        trow('messages', 'messages'),
        trow('availabil.', 'availabilities'),
        trow('quiz', 'quiz_replies'),
        trow('payments', 'payments'),
        trow('invitations', 'game_invitations'),
    ].join('\n');
    blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Activity*\n\`\`\`\n${table}\n\`\`\`` },
    });

    // Detail that is useful but never urgent.
    const quiet = [
        `${g.withPlayers}/${g.total} games got a player`,
        `${Object.entries(g.bySport).map(([k, n]) => `${k} ${n}`).join(' · ')}`,
        `${g.cancelled} cancelled`,
        `${N(d.msg.activeGames)} games with chat`,
        p.total ? `${p.total} payment attempt${p.total === 1 ? '' : 's'}` : 'no payments',
        d.err ? `${N(d.err.throttle)} throttling (benign)` : null,
    ].filter(Boolean);
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: quiet.join('  ·  ') }] });

    if (g.topCentres.length) {
        blocks.push({
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `*busiest*  ${g.topCentres.slice(0, 4).map(([k, n]) => `${k} (${n})`).join('  ')}` }],
        });
    }
    return { blocks };
}

(async () => {
    const [vol, gm, msg, sup, pay] = await Promise.all([
        volumes(), games(), messages(), support(), payments(),
    ]);
    const d = { vol, games: gm, msg, sup, pay };
    if (!NO_LOGS) {
        try { d.err = cfErrors(); } catch (e) { console.error('log read failed:', e.message.slice(0, 80)); }
        try { d.push = pushHealth(); } catch (e) { /* non-fatal */ }
    }
    const text = render(d);
    console.log(text);
    if (SLACK) {
        const payload = slackPayload(d);
        if (DRY) console.log('\n--- slack payload (dry) ---\n' + JSON.stringify(payload, null, 1));
        else post(payload);
    }
    process.exit(0);
})().catch(e => {
    // A silent failure is the worst outcome: nobody can tell "production is
    // fine" from "the monitor is dead". If we were asked to post, post the
    // failure too. Same rule as daily_health_report.js.
    console.error('FATAL', e && e.message);
    if (SLACK && !DRY) {
        try {
            post({
                blocks: [
                    { type: 'header', text: { type: 'plain_text', text: '⚠️ Production check failed to run', emoji: true } },
                    { type: 'section', text: { type: 'mrkdwn', text: `The check itself broke, so *production status is unknown*.\n\`\`\`${String(e && (e.stderr || e.message) || e).split('\n')[0].slice(0, 300)}\`\`\`` } },
                    { type: 'context', elements: [{ type: 'mrkdwn', text: 'run `node scripts/whats_going_on.js` on the Mac to see the full error' }] },
                ],
            });
        } catch (_) { /* nothing left to try */ }
    }
    process.exit(1);
});
