/**
 * Shared Slack report builder for Poteau.
 *
 * Every report posted to #health-reports - daily, one-shot, post-release
 * monitor - should be built with this so they look like one family.
 *
 * See REPORT_TEMPLATE.md for the design rules and worked examples.
 *
 *   const R = require('./slack_report');
 *   await R.post(R.build({
 *     title: 'publishGame — 2h after deploy',
 *     subtitle: 'watching since 14:00',
 *     findings: [ R.red('X is broken', 'so what') ],
 *     table: { columns: ['before','after'], rows: [['errors', 12, 0]] },
 *     quiet: ['checked 1,204 games', 'no rollback needed'],
 *   }));
 */

const { execFileSync } = require('child_process');
const fs = require('fs');

const WEBHOOK_ENV = `${process.env.HOME}/.poteau/slack_webhook.env`;

// ---------------------------------------------------------------- alignment
// Slack renders monospace ONLY inside a ``` block. Anywhere else the font is
// proportional and columns cannot align, which is why every table here is
// wrapped in a code fence rather than built from `fields`.
const pad = (s, n) => { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); };
const padL = (s, n) => { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; };
const num = (v) => (v === undefined || v === null) ? '—' : (typeof v === 'number' ? v.toLocaleString() : String(v));

// ----------------------------------------------------------------- findings
// A finding is: severity, WHAT (bold, scannable), SO WHAT (italic, indented).
// The consequence is the part worth reading; it never gets buried mid-sentence.
const finding = (dot, what, soWhat) => ({ dot, what, soWhat });
const red = (what, soWhat) => finding('🔴', what, soWhat);
const amber = (what, soWhat) => finding('🟡', what, soWhat);
const green = (what, soWhat) => finding('🟢', what, soWhat);

/**
 * Build a Slack blocks payload.
 *
 * @param {string}   title      what this report is about (no emoji - added)
 * @param {string}   subtitle   dim one-liner: window, scope, vital stats
 * @param {object[]} findings   from red()/amber()/green(); [] means all clear
 * @param {object}   table      { columns: [...], rows: [[label, ...values]] }
 * @param {string[]} quiet      healthy//context facts, collapsed to one dim line
 * @param {string}   footer     provenance: what generated this and when
 * @param {string}   verdict    override the auto verdict text
 */
function build({ title, subtitle, findings = [], table = null, quiet = [], footer = null, verdict = null }) {
    const hasRed = findings.some(f => f.dot === '🔴');
    const hasAmber = findings.some(f => f.dot === '🟡');
    const light = hasRed ? '🔴' : (hasAmber ? '🟡' : '🟢');

    const auto = hasRed ? 'incident'
        : (hasAmber ? `${findings.filter(f => f.dot === '🟡').length} to look at` : 'all clear');

    const blocks = [];

    // 1. HEADLINE - the verdict IS the header. Never repeat it on a second line.
    blocks.push({
        type: 'header',
        text: { type: 'plain_text', text: `${light} ${title} — ${verdict || auto}`, emoji: true },
    });

    // 2. VITALS - one dim line. The numbers that decide whether to read on.
    if (subtitle) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: subtitle }] });
    }

    // 3. FINDINGS - the only full-width prose in the whole message.
    //    Sorted red-first; green findings are omitted unless they are the
    //    entire message (a positive confirmation for a one-shot monitor).
    if (findings.length) {
        const order = { '🔴': 0, '🟡': 1, '🟢': 2 };
        const shown = findings.slice().sort((a, b) => order[a.dot] - order[b.dot]);
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: shown.map(f => `${f.dot}  *${f.what}*${f.soWhat ? `\n    _${f.soWhat}_` : ''}`).join('\n\n'),
            },
        });
    }

    // 4. ONE divider. More than one and every section looks equally important.
    if (table) blocks.push({ type: 'divider' });

    // 5. TABLE - plain numbers, no deltas or percentages. Let the eye compare.
    if (table) {
        const { columns = [], rows = [], label = 'Data', note = null, labelWidth = 16, colWidth = 9 } = table;
        const head = pad('', labelWidth) + columns.map(c => padL(c, colWidth)).join('');
        const body = rows.map(r => pad(r[0], labelWidth) + r.slice(1).map(v => padL(num(v), colWidth)).join(''));
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*${label}*${note ? `  _${note}_` : ''}\n\`\`\`\n${head}\n\n${body.join('\n')}\n\`\`\`` },
        });
    }

    // 6. QUIET - everything healthy, compressed. NO green ticks: a checkmark
    //    next to a fine thing competes with the real warnings for attention.
    if (quiet.length) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: quiet.join('   ·   ') }] });
    }

    if (footer) {
        blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: footer }] });
    }

    return { blocks };
}

function post(payload) {
    const env = fs.readFileSync(WEBHOOK_ENV, 'utf8');
    const url = (env.match(/SLACK_WEBHOOK_URL="([^"]+)"/) || [])[1];
    if (!url) throw new Error('SLACK_WEBHOOK_URL not found in ' + WEBHOOK_ENV);
    return execFileSync('curl', ['-s', '-X', 'POST', '-H', 'Content-type: application/json',
        '--data', JSON.stringify(payload), url], { encoding: 'utf8' });
}

module.exports = { build, post, red, amber, green, finding, pad, padL, num };
