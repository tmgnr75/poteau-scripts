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
// Resolved rather than hardcoded, because this same file is vendored into the
// Cloud Functions bundle (scripts/sync_health_report.sh) where the Mac's
// absolute paths do not exist. In the cloud both modules are ordinary
// dependencies and resolve normally; on the Mac the scripts repo has no
// node_modules of its own, so fall back to the functions repo's copy.
function dep(name) {
    try {
        return require(name);
    } catch (e) {
        return require(`/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/${name}`);
    }
}
const admin = dep('firebase-admin');
const { DateTime } = dep('luxon');

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

// Only initialise when nothing has already. Required as a module by the Cloud
// Function the app usually exists, and a second initializeApp throws.
//
// The key file is the MAC's credential and does not exist in the cloud, where
// the function already runs as a service account with ambient credentials. Try
// the key, fall back to the default — never let a missing local file be the
// reason the cloud report dies.
if (!admin.apps.length) {
    try {
        admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
    } catch (e) {
        admin.initializeApp({ projectId: PROJECT });
    }
}
const db = admin.firestore();

// The host supplies the four things that differ between the Mac and the cloud
// (log reads, scheduler listing, git deploys, Slack posting). Defaults to the
// Mac host so the launchd path and `node daily_health_report.js` are unchanged;
// the Cloud Function calls setHost() with its own before building.
let HOST = require('./health_report_host.js');
function setHost(h) { HOST = h; }

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

async function errors(startZ, endZ) {
    const base = `severity>=ERROR AND timestamp>="${startZ}" AND timestamp<"${endZ}"`;
    const count = async (filter) => (await HOST.readLogs(filter, { limit: 1000 })).length;
    const total = await count(base);
    // "Real" must use the SAME exclusions as the per-service breakdown below,
    // or the headline claims N real errors while listing none of them.
    const realFilter = `${base} AND NOT textPayload:"no available instance" AND NOT httpRequest.userAgent:"axios"`;
    const real = await count(realFilter);

    // Group the real ones by service so the report can name them.
    //
    // Exclude requests made by axios: the Flutter apps use Dart's http client,
    // and no Cloud Function calls these endpoints internally, so an axios user
    // agent is a human running probes from a laptop - i.e. us, debugging.
    // On 2026-08-03 an investigation produced a 104-error burst that the report
    // then presented as a production incident affecting users. Own traffic must
    // never masquerade as a user-facing failure.
    // withDetail so textPayload comes back: the cold-start split and the
    // per-service samples below both read it, and without it every entry looks
    // like an empty message — cold starts get counted as code errors and every
    // finding falls back to "something is genuinely failing".
    const realEntries = await HOST.readLogs(realFilter, { limit: 500, withDetail: true });

    // COLD STARTS ARE NOT BUGS, and they are not the same thing as capacity
    // throttling ("no available instance") already filtered above.
    //
    // A container that fails its startup probe once, or a 503 from a readiness
    // check, is Cloud Run scaling from zero — the request is retried and the
    // user is served. Counting these as production failures is what made
    // 2026-08-14 look like 7 errors when only 3 were code: 4 were instances
    // starting up. They are surfaced as their own dim line rather than hidden,
    // because a SPIKE in them is a real signal (a function whose cold start
    // got slower), even though a handful a day is normal.
    const COLD_START = /STARTUP TCP probe failed|failed the readiness check|Connection failed with status DEADLINE_EXCEEDED/i;
    const isColdStart = (e) => COLD_START.test(e.textPayload || '');

    const coldStarts = realEntries.filter(isColdStart);
    const codeErrors = realEntries.filter((e) => !isColdStart(e));

    const byService = {};
    codeErrors.forEach((e) => {
        const name = e.service || 'unknown';
        byService[name] = (byService[name] || 0) + 1;
    });

    const coldByService = {};
    coldStarts.forEach((e) => {
        const name = e.service || 'unknown';
        coldByService[name] = (coldByService[name] || 0) + 1;
    });

    // One concrete sample per offending service, so the finding can say what
    // actually went wrong instead of telling the reader to go dig.
    // Taken from the entries ALREADY fetched, not re-queried per service.
    // One extra log read per failing service was affordable while the n<5 gate
    // meant almost nothing was ever reported; now that every service is named
    // it would be one query each, every morning, for data already in hand. It
    // also guarantees the sample comes from the same set the count came from —
    // a re-query could return a cold-start entry as the sample for a service
    // whose counted errors were all code.
    // INSTANCE CONCENTRATION. If every error from a service came from one
    // container while that service also served requests from others, the fault
    // is that container, not the dependency it appears to be blaming.
    //
    // On 2026-08-17 all 14 letsPay errors read "You did not provide an API key"
    // and came from a single instance, while other instances served 200s the
    // same day -- including 5 minutes after the last failure. Read as a rate
    // ("14 failures is real") it looks like Stripe is down. Read per instance
    // it is one bad container, which is a different investigation and, in that
    // case, exposed a secret that had never been bound at all.
    const instancesByService = {};
    codeErrors.forEach((e) => {
        const svc = e.service || 'unknown';
        if (!e.instanceId) return;
        (instancesByService[svc] = instancesByService[svc] || new Set()).add(e.instanceId);
    });
    const singleInstance = {};
    for (const [svc, set] of Object.entries(instancesByService)) {
        if (set.size === 1 && (byService[svc] || 0) >= 3) singleInstance[svc] = [...set][0];
    }

    const samples = {}, hints = {};
    for (const svc of Object.keys(byService)) {
        if (svc === 'unknown') continue;
        try {
            const found = codeErrors.filter((x) => x.service === svc);
            if (!found.length) continue;
            // Prefer an entry that actually carries a message: a 503 with no
            // textPayload says far less than a stack trace from the same service.
            const pick = found.find((x) => x.textPayload && x.textPayload.trim()) || found[0];
            const { textPayload: txt, status, latency, userAgent: ua } = pick;
            if (txt && txt !== 'null') {
                samples[svc] = txt.split('\n')[0].slice(0, 140);
            } else if (status) {
                // A bare status code tells the reader nothing. Translate it,
                // and use latency to distinguish a timeout (which looks like a
                // generic 504) from a genuine upstream failure.
                const secs = parseFloat(latency) || 0;
                const caller = /Cloud-Scheduler/i.test(ua || '') ? 'the scheduler' : 'a client';
                const meaning = {
                    504: secs >= 55
                        ? `timed out after ${Math.round(secs)}s — the function needs longer than its timeoutSeconds`
                        : 'gateway timeout',
                    500: 'unhandled exception inside the function',
                    503: 'service unavailable — the instance could not start',
                    429: 'rate limited',
                    400: 'bad request — the caller sent invalid parameters',
                    403: 'permission denied',
                }[Number(status)] || `HTTP ${status}`;
                samples[svc] = `${meaning} (called by ${caller})`;
                if (Number(status) === 504 && secs >= 55) hints[svc] = 'raise timeoutSeconds, or make the job process fewer items per run';
            }
        } catch (err) { /* sampling is best-effort */ }
    }

    const indexErrors = (await HOST.readLogs(
        `${base} AND (textPayload:"FAILED_PRECONDITION" OR textPayload:"requires an index")`,
        { limit: 20, withDetail: true }
    )).map((e) => e.textPayload).filter((t) => t && t.trim());

    // `real` is now CODE errors only. The headline number a human reacts to
    // must be the number of things that are actually wrong, and cold starts
    // are reported separately rather than folded in — otherwise a morning with
    // three genuine bugs and four container restarts reads as "7 errors", and
    // the reader cannot tell which half matters.
    return {
        total,
        real: codeErrors.length,
        throttled: total - real,
        coldStarts: coldStarts.length,
        coldByService,
        byService,
        indexErrors,
        samples,
        hints,
        singleInstance,
    };
}

// ------------------------------------------------------- money safety

// Failures that cost a user money, found WITHOUT a severity filter.
//
// Everything else in this report keys off `severity>=ERROR`. That is the right
// default for noise, and it is exactly why this section exists separately:
// `console.error` on Cloud Run lands at DEFAULT severity, not ERROR. Any
// money-losing failure logged that way is invisible to the rest of the report.
//
// That is not theoretical. removePlayer failed to release Stripe authorizations
// ten times between 2026-07-23 and 2026-08-18 because the function never
// declared STRIPE_SECRET. Each failure left a live hold that was captured at
// T-1h, so players paid for games they had left. Every one was logged with
// console.error inside a deliberate catch, no report ever mentioned it, and we
// learned about it when a user emailed to say he had been charged twice.
//
// So: match on TEXT, not severity, and check the resulting state in Firestore
// rather than trusting that a log line would have been loud.
async function moneySafety(startZ, endZ) {
    const window = `timestamp>="${startZ}" AND timestamp<"${endZ}"`;
    const findings = [];

    // 1. Any Stripe call that ran without a usable key. The generic SDK message
    //    is matched too, because a missing key surfaces as "did not provide an
    //    API key" from deep inside the SDK when nothing catches it first.
    const keyless = await HOST.readLogs(
        `${window} AND (textPayload:"STRIPE_KEY_MISSING" OR textPayload:"did not provide an API key" OR textPayload:"StripeAuthenticationError")`,
        { limit: 100, withDetail: true }
    );
    if (keyless.length) {
        findings.push({
            code: 'STRIPE_KEY_MISSING',
            n: keyless.length,
            what: 'a Stripe call ran without a usable API key',
            soWhat: 'authorizations may not have been released; players can be charged for games they left',
        });
    }

    // 2. The explicit alert removePlayer now emits when it cannot release a hold.
    const stranded = await HOST.readLogs(
        `${window} AND textPayload:"PAYMENT_STRANDED"`,
        { limit: 100, withDetail: true }
    );
    if (stranded.length) {
        findings.push({
            code: 'PAYMENT_STRANDED',
            n: stranded.length,
            what: 'a player left a game but their payment authorization could not be released',
            soWhat: 'that money is still held and will be captured unless someone cancels it',
        });
    }

    return { findings };
}

// -------------------------------------------------------------- cron health

async function crons(asOf) {
    // Degrade to a warning rather than killing the whole report: losing one
    // check is bad, losing the entire morning report is worse. On the Mac the
    // classic failure was an expired user OAuth token (launchd has no browser
    // to reauthenticate with), which is why both hosts use a service account.
    let rows;
    try {
        rows = await HOST.listCronJobs();
    } catch (err) {
        const msg = String(err.stderr || err.message || '');
        // Log it: this path degrades to a warning inside the report, so without
        // this the actual cause (a permission, a wrong location, an expired
        // token) never appears anywhere and the report just says "check failed".
        console.error('[healthReport] cron listing failed:', msg.split('\n')[0]);
        const expired = /Reauthentication failed|auth tokens|gcloud auth login/i.test(msg);
        return {
            error: expired
                ? 'gcloud auth has expired — run `gcloud auth login` in a terminal'
                : msg.split('\n')[0].slice(0, 160),
            jobs: [], stale: [],
        };
    }

    // A blind check that reports success is worse than no check. If the
    // permission ever regresses the API returns nothing, and we would silently
    // claim every cron is healthy.
    if (rows.length === 0) {
        return { error: 'scheduler returned 0 jobs — permission regression? Expected ~12.', jobs: [], stale: [] };
    }

    const stale = [];
    for (const { name, schedule, lastAttempt: last } of rows) {
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

    // Only flag days that SHOULD already be full: D+0..D+18.
    //
    // The last two days of the window are excluded deliberately. This report
    // runs at 08:30 but scheduleGames fills the horizon at 11:00, so the
    // newest day has not been topped up yet when we look, and a day only
    // receives games from repeaters whose weekday happens to land on it -
    // it arrives with ~20-30 of its eventual ~80 and thickens over following
    // runs. Flagging the leading edge was a guaranteed daily false positive
    // (2026-08-04 flagged "25 Aug has only 15 games" two hours before the
    // cron that fills it).
    const inner = days.filter(d => {
        const n = DateTime.fromISO(d).diff(now.startOf('day'), 'days').days;
        return n >= 0 && n <= 18;
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

// Delegated to the host: the Mac reads the local checkouts, the cloud has none
// and returns [] so the section is omitted rather than falsely claiming that
// nothing shipped.
function deploys(sinceISO, untilISO) {
    return HOST.recentDeploys(sinceISO, untilISO);
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

function build(day, a, e, c, h, dep, m) {
    // Each warning is: severity dot, bold WHAT, then a plain-language SO WHAT
    // on its own indented line. The consequence is the part worth reading and
    // it should not be buried mid-sentence.
    // Every finding carries a recommendation. An amber dot with no next step
    // is just anxiety - the reader cannot tell whether to act or ignore it.
    const attention = [];
    const warn = (dot, what, soWhat, doWhat) => attention.push({ dot, what, soWhat, doWhat });

    // Money first. Everything else in this report is about the platform being
    // healthy; this is about a specific person being wrongly charged, which
    // outranks every other finding and must never sit below a thin-day notice.
    ((m && m.findings) || []).forEach(f => warn('🔴',
        `${f.code} (${f.n} ${f.n === 1 ? 'time' : 'times'}) — ${f.what}`,
        f.soWhat,
        'find the affected users and refund them BEFORE fixing the cause — the money already moved'));

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
    // NOTE: h.thin already excludes the last 2 days of the window - see
    // horizon(). The report runs at 08:30 but scheduleGames fills the window
    // at 11:00, so the newest days are ALWAYS unfilled when this runs and
    // flagging them is a guaranteed daily false positive.
    h.thin.forEach(t => warn('🟡', `${DateTime.fromISO(t.day).toFormat('ccc d LLL')} has only ${t.n} games`,
        'unusually thin for a day well inside the window, which should be full by now',
        'check whether centres paused their repeaters for that date'));
    // EVERY failing service is named. No threshold.
    //
    // This used to skip any service with fewer than 5 errors in a day, which
    // sounds like sensible noise control and was not: real errors here arrive
    // 1-9 a day spread thinly across five or six services, so the gate hid
    // ALL of them, every day, while the header still counted them. The report
    // said "🟢 all clear · 7 real errors" — a green light above a non-zero
    // error count, which is the report contradicting itself in its own
    // headline. Measured 2026-08-09..15: not one service ever reached 5, so
    // the branch below was dead code for the entire life of the report.
    //
    // Two of the things it hid were genuine bugs: a `price: undefined` crash
    // in scheduleGames/createGamesFromRepeater (5 hits) and editGamesFromRepeater
    // updating deleted repeaters (5 hits).
    //
    // Volume now sets SEVERITY rather than visibility, and cold starts are
    // classified separately below, which is what actually removes the noise.
    Object.entries(e.byService).sort((x, y) => y[1] - x[1]).forEach(([svc, n]) => {
        const known = {
            getplacedetails: ['Google Places API rate limit', 'raise the quota or add caching — place lookups are silently failing for users'],
            unreservespots: ['Remote Config read quota exceeded', 'behaviour is correct (falls back to the 120h default) — cache the RC read to silence it'],
        }[svc];
        // The generic fallback must still say WHAT failed. "Go read the log"
        // is the vague, unactionable line this report exists to avoid, so pull
        // one real sample and quote it.
        const sample = known ? null : e.samples[svc];
        let hint = known ? known[1] : e.hints[svc];
        let soWhat = known ? known[0] : (sample || 'not capacity throttling, so something is genuinely failing');

        // CLASSIFY BY CAUSE, not just by volume. Some failures are a config
        // gap rather than a flaky dependency, and saying so turns a morning of
        // log-reading into a one-line fix. These patterns are matched against
        // the sample, which is why reading jsonPayload matters -- see the
        // hosts' extractText.
        const CAUSES = [
            [/did not provide an API key|No API key provided|Invalid API Key|api[_ ]key/i,
                'a credential is missing or wrong — this is configuration, not a flaky dependency',
                'check the secret is DECLARED on the function (secrets: [...]) and that the env var name matches what the code reads'],
            [/PERMISSION_DENIED|IAM|insufficient permission|caller does not have permission/i,
                'the function lacks an IAM permission',
                'grant the role to the function\'s service account'],
            [/Memory limit of .* exceeded/i,
                'the container ran out of memory and was killed mid-request',
                'raise the memory setting, or process fewer items per run'],
            [/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/i,
                'a network call to an upstream service failed',
                'check the upstream\'s status before changing our code'],
            [/quota|rate[- ]?limit|RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|429/i,
                'an upstream quota or rate limit was hit',
                'raise the quota or add caching'],
        ];
        const matched = sample && CAUSES.find(([re]) => re.test(sample));
        if (matched && !known) { soWhat = matched[1]; hint = hint || matched[2]; }

        // Volume sets severity now that it no longer sets visibility. A single
        // failure is worth naming but is not an incident; a sustained rate is.
        // A credential/config fault is red at ANY volume: it does not heal, and
        // it usually means a whole code path is dead rather than flaky.
        const isConfigFault = Boolean(matched) && matched === CAUSES[0];
        const dot = (n >= 5 || isConfigFault) ? '🔴' : '🟡';

        // A fault confined to one container while others served fine is a bad
        // instance, and saying "14 failures is a real rate" actively misleads.
        const pinned = e.singleInstance && e.singleInstance[svc];
        if (pinned) {
            soWhat += ` — all ${n} from ONE container (${pinned.slice(0, 12)}…), so this is an instance fault, not a service-wide outage`;
            hint = hint || 'check whether the container booted without a secret or config it reads only at startup';
        }

        // A single occurrence still gets a next step. "Low volume, but genuine"
        // told the reader nothing they could act on, and it was the line under
        // three separate `price: undefined` crashes that recurred daily for a
        // week -- each looking like a one-off because each day showed one hit.
        const genericLow = sample
            ? `${n === 1 ? 'One occurrence' : `${n} occurrences`} — reproduce it from the quoted error before assuming it is transient`
            : 'low volume, but it is a genuine failure rather than throttling';

        warn(dot, `${svc} — ${n} error${n === 1 ? '' : 's'}`, soWhat,
            hint || (n >= 5
                ? `${n} failures in one day is a real rate — check whether users are affected`
                : genericLow));
    });

    // Cold starts get ONE dim line, never one per service. They are normal at
    // a handful a day; the reason to show them at all is that a jump is a real
    // signal about a function's startup time. Above 20 in a day that stops
    // being background and becomes something to look at.
    if (e.coldStarts > 0) {
        const worst = Object.entries(e.coldByService || {})
            .sort((x, y) => y[1] - x[1]).slice(0, 3)
            .map(([s, n]) => `${s} ×${n}`).join(', ');
        if (e.coldStarts >= 20) {
            warn('🟡', `${e.coldStarts} cold-start failures`,
                `containers failing their startup probe (${worst}) — well above the usual handful`,
                'check whether a recent deploy slowed a function\'s boot, or set minInstances on the busiest one');
        }
    }

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
        // Only claim a clean bill of health when the error count is actually
        // zero. This sentence used to run whenever nothing crossed a warning
        // threshold, so it asserted "no errors beyond normal capacity
        // throttling" on a day with 7 real ones.
        sentences.push(e.real === 0
            ? 'No errors beyond normal capacity throttling, all crons on schedule, game horizon healthy.'
            : `All crons on schedule and the game horizon is healthy. ${e.real} error${e.real === 1 ? '' : 's'} listed above.`);
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
        `${e.real} code error${e.real === 1 ? '' : 's'} of ${e.total} log errors`,
        `${e.coldStarts || 0} cold start${e.coldStarts === 1 ? '' : 's'}`,
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

/**
 * Compute the report for one day and return the Slack payload.
 *
 * Exported so the Cloud Function can run the IDENTICAL logic with its own host
 * — see health_report_host.js for why there is one report and not two. Posts
 * nothing: the caller decides, so a dry run and the real run share this path.
 */
async function buildReport(targetDate) {
    const target = targetDate || (dateArg
        ? DateTime.fromISO(dateArg, { zone: TZ })
        : DateTime.now().setZone(TZ).minus({ days: 1 }));
    const dayStart = target.startOf('day'), dayEnd = target.endOf('day');

    const d0 = [dayStart.toJSDate(), dayEnd.toJSDate()];
    const d1 = [dayStart.minus({ days: 1 }).toJSDate(), dayStart.toJSDate()];
    const d7 = [dayStart.minus({ days: 7 }).toJSDate(), dayStart.minus({ days: 6 }).toJSDate()];

    const a = await activity(d0, d1, d7);
    const e = await errors(dayStart.toUTC().toISO(), dayEnd.toUTC().toISO());
    const c = await crons(dayEnd.toJSDate());
    const h = await horizon();
    const dep = await deploys(dayStart.toISODate(), dayEnd.toISODate());
    const m = await moneySafety(dayStart.toUTC().toISO(), dayEnd.toUTC().toISO());

    return build(target, a, e, c, h, dep, m);
}

module.exports = { buildReport, setHost };

// Run as a script (the Mac/launchd path). When the Cloud Function requires
// this module instead, `require.main` is not this module and nothing below
// executes — it just imports buildReport and drives it with the cloud host.
if (require.main === module) (async () => {
    const payload = await buildReport();

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
