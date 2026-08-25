#!/usr/bin/env node
/**
 * Command-line entry point for the Poteau Daily.
 *
 * The logic lives in daily_signals.js, which is shared with the Cloud Function.
 * This file only does the things a CLI does: parse flags, open Firestore with
 * the service-account key, print, and set the exit code.
 *
 * Usage:
 *   node daily_signals_cli.js                    # yesterday, print only
 *   node daily_signals_cli.js --slack            # post to #newspaper
 *   node daily_signals_cli.js --date=2026-08-24  # a specific day
 *   node daily_signals_cli.js --corpus           # dump the model input, call nothing
 *   node daily_signals_cli.js --json             # print the raw signal objects
 *   node daily_signals_cli.js --blocks           # print the Slack payload
 *   node daily_signals_cli.js --catchup          # publish EVERY day still missing
 *   node daily_signals_cli.js --catchup --max=5  # cap how many days one run does
 */

const path = require('path');

function dep(name) {
    try { return require(name); }
    catch (e) { return require(`/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/${name}`); }
}
const admin = dep('firebase-admin');
const { DateTime } = dep('luxon');

const SA_PATH = path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT = 'krank-club';

const signals = require('./daily_signals.js');
signals.setHost(require('./daily_signals_host.js'));

const arg = (k, d) => {
    const v = process.argv.find(a => a.startsWith(`--${k}=`));
    return v ? v.split('=')[1] : d;
};
const SLACK = process.argv.includes('--slack');
const DRY = process.argv.includes('--dry');
const CORPUS_ONLY = process.argv.includes('--corpus');
const JSON_OUT = process.argv.includes('--json');
const BLOCKS_OUT = process.argv.includes('--blocks');
const CATCHUP = process.argv.includes('--catchup');
const MAX_DAYS = Number(arg('max', 14) || 14);
const DATE_ARG = arg('date');

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
}
const db = admin.firestore();

// --dry means build everything and post nothing, so it must beat --slack.
const post = SLACK && !DRY;

(async () => {
    if (CATCHUP) {
        const { days, posted } = await signals.runCatchup(db, { maxDays: MAX_DAYS, post });
        if (!days.length) {
            console.log('Nothing missing. Every day through yesterday has a list.');
            process.exit(0);
        }
        console.error(`[daily_signals] published ${posted} of ${days.length}`);
        process.exit(0);
    }

    const target = DATE_ARG
        ? DateTime.fromISO(DATE_ARG, { zone: signals.TZ })
        : DateTime.now().setZone(signals.TZ).minus({ days: 1 });

    const r = await signals.runOneDay(db, target, { post, corpusOnly: CORPUS_ONLY });

    if (CORPUS_ONLY) { console.log(r.corpus); process.exit(0); }
    if (JSON_OUT) { console.log(JSON.stringify(r.signals, null, 2)); process.exit(0); }
    if (BLOCKS_OUT) { console.log(JSON.stringify({ blocks: r.blocks }, null, 2)); process.exit(0); }

    console.log(signals.toText(r.signals, r.meta));
    if (DRY) console.error('\n[daily_signals] dry: nothing posted, nothing marked');
    process.exit(0);
})().catch(e => {
    // Never fail silently: a missing list must not look like a quiet day.
    console.error('DAILY SIGNALS FAILED:', e && e.message);
    process.exit(1);
});
