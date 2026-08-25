/**
 * Mac host for the Poteau Daily.
 *
 * WHY THIS FILE EXISTS. The Daily runs in two places:
 *
 *   the Mac      by hand, `node daily_signals.js --date=...`
 *   the cloud    a scheduled Cloud Function, immune to the Mac being asleep
 *
 * Everything that decides WHAT is worth Tim's attention lives in
 * daily_signals.js and is identical in both. Only two things differ, and they
 * are exactly the two things a Cloud Function cannot do the same way:
 *
 *   askModel    the Mac shells out to the `claude` CLI, which bills Tim's
 *               subscription; the cloud has no such binary and calls the
 *               Anthropic API with a key from Secret Manager
 *   postSlack   the Mac reads ~/.poteau/newspaper_webhook.env; the cloud reads
 *               process.env.SLACK_WEBHOOK_URL
 *
 * THE POINT IS THAT THERE IS ONE DAILY, NOT TWO. A forked copy would drift: a
 * rule tuned on the Mac would silently not apply in the cloud, and the two
 * would start disagreeing about what counts as a situation.
 */

const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');

// The Daily goes to #newspaper, NOT #health-reports. A Slack incoming webhook
// is bound to one channel when created, so this needs its own URL and cannot
// reuse slack_webhook.env. Fails loudly when missing rather than falling back:
// a list full of player names must never land in the infrastructure channel.
const WEBHOOK_ENV = process.env.NEWSPAPER_WEBHOOK_ENV
    || `${process.env.HOME}/.poteau/newspaper_webhook.env`;

/**
 * Ask the model, via the CLI.
 *
 * spawnSync, not execFileSync: execFileSync's `timeout` kills with SIGTERM and
 * then throws with an EMPTY message, so a run that produced a perfectly good
 * answer is reported as "Command failed". Here the exit status and stderr are
 * inspected explicitly and a non-empty stdout is trusted even on a non-zero
 * exit.
 *
 * The CLI also prints transient API failures ("API Error: 529 Overloaded") to
 * STDOUT and exits 0, so a non-empty stdout is not by itself proof of an
 * answer. The caller parses JSON out of this, which catches that case: an error
 * string is not a JSON object, so it throws and the retry loop handles it.
 */
async function askModel(prompt) {
    const res = spawnSync('claude', ['-p'], {
        input: prompt,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: 15 * 60 * 1000,
    });
    const out = (res.stdout || '').trim();
    if (out) return out;

    const why = res.error ? res.error.message
        : (res.stderr || '').trim() || `claude exited ${res.status} with no output`;
    throw new Error(`the writer produced nothing: ${why}`);
}

function slackWebhookUrl() {
    if (!fs.existsSync(WEBHOOK_ENV)) {
        throw new Error(
            `no webhook for #newspaper at ${WEBHOOK_ENV}. Create an incoming webhook ` +
            `for that channel and save it as SLACK_WEBHOOK_URL="https://hooks.slack.com/..."`);
    }
    const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
    const url = (env.match(/SLACK_WEBHOOK_URL=["']?([^"'\n]+)/) || [])[1];
    if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);
    return url;
}

/**
 * Post to Slack and VERIFY it landed.
 *
 * `curl -s` exits 0 whether Slack answered "ok" or rejected the payload with
 * 400 invalid_blocks, so a naive version cannot tell success from failure: a
 * rejected edition marks itself published in the ledger and vanishes. The body
 * is the only reliable signal, so it is read and anything but "ok" throws.
 */
async function postSlack(payload) {
    const body = JSON.stringify(payload);
    const out = execFileSync('curl', [
        '-sS', '--max-time', '30',
        '-w', '\n%{http_code}',
        '-X', 'POST', '-H', 'Content-type: application/json',
        '--data-binary', '@-', slackWebhookUrl(),
    ], { encoding: 'utf8', input: body });

    const lines = out.trim().split('\n');
    const code = lines.pop();
    const reply = lines.join('\n').trim();
    if (code !== '200' || reply !== 'ok') {
        throw new Error(`Slack rejected the post (HTTP ${code}): ${reply.slice(0, 200)}`);
    }
    return true;
}

module.exports = { name: 'mac', askModel, postSlack };
