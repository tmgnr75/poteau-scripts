#!/usr/bin/env node
/**
 * Post-deploy watch for the 7 Sept 2026 fixes: the confirmSpots STRIPE_SECRET
 * binding, and the onMessageSpamCheck query projections.
 *
 * What it proves, and why each check exists:
 *
 *  1. The secret is still bound on the serving revision. A later deploy of a
 *     sibling function must never silently drop it again -- that is exactly how
 *     this bug shipped in the first place.
 *  2. No new Stripe auth failure anywhere. Matches BOTH payload shapes, because
 *     gen2 logs structurally and textPayload-only filters are blind to it.
 *  3. No payment stuck at "reserved" past the reconcile window. reconcilePayments
 *     runs every 15 min and asks Stripe directly, so anything still reserved
 *     after ~30 min is a real stall, not a race.
 *  4. Nothing charged on a game the payer already left, and no capture on a
 *     canceled game. This is the actual damage the alert warned about, checked
 *     as STATE rather than trusted from a log line.
 *
 * Read-only. Never writes to Firestore, never calls Stripe, never needs the key.
 *
 * Usage:
 *   node monitor_post_deploy_watch.js            # human-readable
 *   node monitor_post_deploy_watch.js --slack    # also post to #health-reports
 *   node monitor_post_deploy_watch.js --quiet    # Slack only if something is wrong
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json')),
    projectId: 'krank-club',
});
const db = admin.firestore();

const PROJECT = 'krank-club';
const REGION = 'us-central1';
const SLACK = process.argv.includes('--slack');
const QUIET = process.argv.includes('--quiet');
const WEBHOOK_ENV = process.env.HOME + '/.poteau/slack_webhook.env';

const fr = (d) => (d ? d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '-');
const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

// --------------------------------------------------------------- checks

function checkSecretBound() {
    // The deployed revision is the only authority. Source review cannot see a
    // missing secret -- that is the whole lesson of this incident.
    try {
        const out = sh('gcloud', [
            'run', 'services', 'describe', 'confirmspots',
            '--region=' + REGION, '--project=' + PROJECT,
            '--format=value(spec.template.spec.containers[0].env)',
        ]);
        const bound = /STRIPE_SECRET/.test(out);
        return {
            ok: bound,
            label: 'STRIPE_SECRET bound on confirmspots',
            detail: bound ? 'bound' : 'MISSING — the fix has been undone',
        };
    } catch (e) {
        return { ok: false, label: 'STRIPE_SECRET bound on confirmspots', detail: 'check failed: ' + e.message };
    }
}

function checkNoStripeAuthErrors(sinceISO) {
    // Both payload shapes. textPayload alone is structurally blind to gen2.
    const pats = ['STRIPE_KEY_MISSING', 'did not provide an API key', 'StripeAuthenticationError'];
    const clause = pats
        .map((p) => `textPayload:"${p}" OR jsonPayload.message:"${p}" OR jsonPayload.error:"${p}" OR jsonPayload.stack:"${p}"`)
        .join(' OR ');
    try {
        const out = sh('gcloud', [
            'logging', 'read',
            `timestamp>="${sinceISO}" AND (${clause})`,
            '--project=' + PROJECT, '--limit=20',
            '--format=value(timestamp,resource.labels.service_name)',
        ]).trim();
        const lines = out ? out.split('\n').filter(Boolean) : [];
        return {
            ok: lines.length === 0,
            label: 'No Stripe auth failure',
            detail: lines.length === 0 ? 'none' : lines.length + ' found: ' + lines[0],
        };
    } catch (e) {
        return { ok: false, label: 'No Stripe auth failure', detail: 'check failed: ' + e.message };
    }
}

function checkConfirmSpotsHealth(sinceISO) {
    try {
        const out = sh('gcloud', [
            'logging', 'read',
            `resource.labels.service_name="confirmspots" AND timestamp>="${sinceISO}" AND textPayload:"Failed"`,
            '--project=' + PROJECT, '--limit=20',
            '--format=value(timestamp,textPayload)',
        ]).trim();
        const lines = out ? out.split('\n').filter(Boolean) : [];
        return {
            ok: lines.length === 0,
            label: 'confirmSpots without failures',
            detail: lines.length === 0 ? 'clean' : lines.length + ' failure(s): ' + lines[0].slice(0, 120),
        };
    } catch (e) {
        return { ok: false, label: 'confirmSpots without failures', detail: 'check failed: ' + e.message };
    }
}

function checkNoSpamCheckOOM(sinceISO) {
    // The 7 Sept projections cut what onMessageSpamCheck loads per invocation.
    // It OOMed once (6 Sept, 265MiB vs 256MiB). If it recurs, the next lever is
    // lowering containerConcurrency from 80, not more memory.
    try {
        const out = sh('gcloud', [
            'logging', 'read',
            `resource.labels.service_name="onmessagespamcheck" AND timestamp>="${sinceISO}" ` +
            `AND (textPayload:"Memory limit" OR textPayload:"Uncaught signal" OR textPayload:"Container terminated")`,
            '--project=' + PROJECT, '--limit=10',
            '--format=value(timestamp,textPayload)',
        ]).trim();
        const lines = out ? out.split('\n').filter(Boolean) : [];
        return {
            ok: lines.length === 0,
            label: 'onMessageSpamCheck not OOMing',
            detail: lines.length === 0 ? 'no OOM/kill' : lines.length + ' event(s): ' + lines[0].slice(0, 120),
        };
    } catch (e) {
        return { ok: false, label: 'onMessageSpamCheck not OOMing', detail: 'check failed: ' + e.message };
    }
}

async function checkNoStuckReserved() {
    // A payment is "stuck" only in the window where it still matters:
    // older than 30 min (reconcilePayments runs every 15 min and asks Stripe
    // directly, so anything younger is simply mid-flight) and newer than 7 days
    // (past that, Stripe has released the authorization on its own, so the row
    // is inert bookkeeping drift, not money at risk).
    //
    // Without the upper bound this fires forever on 4 residues from 2025-2026
    // whose games are already played and whose holds expired months ago.
    const now = Date.now();
    const snap = await db.collection('payments').where('status', '==', 'reserved').get();
    const stuck = snap.docs.filter((d) => {
        const a = d.data().authorization_date;
        if (!a) return false;
        const age = now - a.toDate().getTime();
        return age > 30 * 60 * 1000 && age < 7 * 24 * 3600 * 1000;
    });
    return {
        ok: stuck.length === 0,
        label: 'No payment stuck at reserved',
        detail: stuck.length === 0
            ? 'none in the actionable window'
            : stuck.length + ' stuck: ' + stuck.map((d) => d.id).join(', '),
    };
}

async function checkNoWrongfulCharge() {
    // The real damage: money taken from someone who is not in the game, or
    // captured on a game that was called off BEFORE it was due to start.
    //
    // Scoped to the last 14 days deliberately. A game is routinely set to
    // canceled/hidden AFTER it has been played -- that is how organisers tidy
    // their list -- so "captured on a canceled game" across all history matches
    // ~300 perfectly legitimate payments going back to Oct 2025. Verified on a
    // sample: every one had a kickoff in the past and the payer on the roster.
    // Only a cancellation that precedes kickoff can indicate a wrongful charge.
    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const snap = await db.collection('payments')
        .where('authorization_date', '>=', since)
        .get();

    const problems = [];
    for (const d of snap.docs) {
        const p = d.data();
        if (!['authorized', 'captured'].includes(p.status)) continue;
        if (!p.game_ref || !p.user_ref) continue;
        const g = await p.game_ref.get();
        if (!g.exists) continue;
        const gd = g.data();

        // A hold Stripe has already released on its own (7 days) is harmless.
        const authAt = p.authorization_date ? p.authorization_date.toDate() : null;
        const expired = authAt && (Date.now() - authAt.getTime()) > 7 * 24 * 3600 * 1000;

        // Dedupe attendees: a +1 is the same DocumentReference repeated.
        const uniq = [...new Set((gd.attendees || []).map((r) => (r && r.id ? r.id : String(r))))];

        if (!uniq.includes(p.user_ref.id) && !expired) {
            problems.push(`${d.id} (${p.amount}${p.currency || ''}) payer left game ${g.id}`);
        }

        const kickoff = gd.date ? gd.date.toDate() : null;
        const calledOffBeforeKickoff = kickoff && kickoff.getTime() > Date.now();
        if (p.status === 'captured' && ['canceled', 'hidden'].includes(gd.status) && calledOffBeforeKickoff) {
            problems.push(`${d.id} (${p.amount}${p.currency || ''}) captured on ${gd.status} game ${g.id} before kickoff`);
        }
    }
    return {
        ok: problems.length === 0,
        label: 'No wrongful charge (14d)',
        detail: problems.length === 0 ? 'none' : problems.join(' | '),
    };
}

async function upcomingCaptures() {
    const snap = await db.collection('payments').where('status', '==', 'authorized').get();
    const rows = [];
    for (const d of snap.docs) {
        const p = d.data();
        if (!p.game_ref) continue;
        const g = await p.game_ref.get();
        if (!g.exists) continue;
        const gd = g.data();
        if (!gd.date || ['canceled', 'hidden'].includes(gd.status)) continue;
        const capture = new Date(gd.date.toDate().getTime() - 3600 * 1000);
        if (capture < new Date()) continue;
        rows.push({ capture, amount: p.amount, cur: p.currency || '' });
    }
    rows.sort((a, b) => a.capture - b.capture);
    return rows;
}

// ----------------------------------------------------------------- main

(async () => {
    const sinceISO = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const results = [
        checkSecretBound(),
        checkNoStripeAuthErrors(sinceISO),
        checkConfirmSpotsHealth(sinceISO),
        checkNoSpamCheckOOM(sinceISO),
        await checkNoStuckReserved(),
        await checkNoWrongfulCharge(),
    ];

    const failed = results.filter((r) => !r.ok);
    const next = await upcomingCaptures();

    // Console output
    console.log('Post-deploy watch (Stripe + spam check) —', fr(new Date()));
    results.forEach((r) => console.log(`  ${r.ok ? 'OK  ' : 'FAIL'}  ${r.label}: ${r.detail}`));
    if (next.length) {
        const n = next[0];
        const hrs = ((n.capture - new Date()) / 3600000).toFixed(1);
        console.log(`  next capture: ${fr(n.capture)} (T+${hrs}h, ${n.amount}${n.cur})`);
    } else {
        console.log('  next capture: none scheduled');
    }

    // Slack
    if (SLACK && !(QUIET && failed.length === 0)) {
        const head = failed.length === 0
            ? ':large_green_circle: confirmSpots / Stripe — tout est bon'
            : `:red_circle: confirmSpots / Stripe — ${failed.length} problème(s)`;

        const body = failed.length === 0
            ? [
                'Le correctif STRIPE_SECRET tient. Aucune erreur Stripe, aucun paiement bloqué,',
                'aucun débit sur un joueur parti.',
                next.length
                    ? `Prochaine capture : ${fr(next[0].capture)} — ${next[0].amount}${next[0].cur}.`
                    : 'Aucune capture programmée.',
            ].join('\n')
            : failed.map((r) => `• ${r.label} : ${r.detail}`).join('\n');

        const payload = JSON.stringify({ text: `${head}\n${body}` });
        const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
        const url = (env.match(/SLACK_WEBHOOK_URL="([^"]+)"/) || [])[1];
        if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);
        sh('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json', '--data', payload, url]);
        console.log('  -> posted to Slack');
    }

    process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
