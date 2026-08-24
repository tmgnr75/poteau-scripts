#!/usr/bin/env node
/**
 * Post-migration watch for ogUserImage (headless Chrome -> sharp, 2026-08-24).
 *
 * The failure it replaced was bursty: "Failed to launch the browser process!"
 * 3-10x/day, only when several shares landed on one cold instance. A quiet
 * hour therefore proves nothing -- this compares a window against the 30-day
 * Chrome-era baseline and reports real scraper traffic separately from any
 * curl testing.
 *
 * Usage: node check_og_image_health.js [hours]   (default 24)
 */
const { execFileSync } = require('child_process');

const HOURS = parseInt(process.argv[2] || '24', 10);
const SERVICE = 'oguserimage';
const CHROME_ERA_DAILY = '3-10';

function logRead(filter, limit = 1000) {
    const out = execFileSync('gcloud', [
        'logging', 'read', filter,
        '--project=krank-club', `--limit=${limit}`, '--format=json',
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return JSON.parse(out || '[]');
}

(function main() {
    const since = new Date(Date.now() - HOURS * 3600e3).toISOString();
    const base = `resource.labels.service_name="${SERVICE}" AND timestamp>="${since}"`;

    const reqs = logRead(`${base} AND httpRequest.requestMethod!=""`);
    const errs = logRead(`${base} AND severity>=ERROR`, 200);

    const launchFailures = logRead(`${base}`, 1000)
        .filter(e => (e.textPayload || '').includes('Failed to launch the browser process'));

    const byStatus = {};
    let scraper = 0, curlish = 0;
    for (const r of reqs) {
        const st = r.httpRequest?.status ?? 0;
        byStatus[st] = (byStatus[st] || 0) + 1;
        const ua = r.httpRequest?.userAgent || '';
        if (/curl|wget/i.test(ua)) curlish++; else scraper++;
    }

    const total = reqs.length;
    const fails = Object.entries(byStatus)
        .filter(([s]) => Number(s) >= 500)
        .reduce((a, [, n]) => a + n, 0);

    console.log(`ogUserImage — last ${HOURS}h`);
    console.log(`  requests      : ${total}  (real ${scraper} / curl ${curlish})`);
    console.log(`  by status     : ${Object.entries(byStatus).map(([s, n]) => `${s}:${n}`).join('  ') || '(none)'}`);
    console.log(`  5xx           : ${fails}${total ? ` (${(100 * fails / total).toFixed(1)}%)` : ''}`);
    console.log(`  ERROR entries : ${errs.length}`);
    console.log(`  Chrome-launch failures: ${launchFailures.length}   [baseline was ${CHROME_ERA_DAILY}/day]`);

    if (launchFailures.length) {
        console.log('\n  REGRESSION: a browser launch failed. sharp does not launch a browser,');
        console.log('  so this means puppeteer code is back on this path.');
        process.exit(1);
    }
    if (fails) {
        console.log('\n  5xx present — inspect before assuming transient:');
        console.log(`  gcloud logging read '${base} AND severity>=ERROR' --project=krank-club --limit=20`);
        process.exit(1);
    }
    if (scraper === 0) {
        console.log('\n  No real scraper traffic yet — inconclusive, not a pass. Re-run later.');
        process.exit(2);
    }
    console.log('\n  Clean: real traffic served, zero launch failures.');
})();
