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
// A finding is: severity, WHAT, SO WHAT, and DO WHAT.
//
// The third part is not optional. "getplacedetails - 56 errors" tells the
// reader nothing they can act on, and an amber dot with no recommendation is
// just anxiety. Every non-green finding must end with a concrete next step,
// including "nothing - this is expected" when that is the honest answer.
//
// Severity is defined by ACTION, not by how bad it sounds:
//   red   - something is broken now; act today
//   amber - worth a decision, but not today
//   green - confirmation that an expectation held (used by one-shot monitors)
const finding = (dot, what, soWhat, doWhat) => ({ dot, what, soWhat, doWhat });
const red = (what, soWhat, doWhat) => finding('🔴', what, soWhat, doWhat);
const amber = (what, soWhat, doWhat) => finding('🟡', what, soWhat, doWhat);
const green = (what, soWhat, doWhat) => finding('🟢', what, soWhat, doWhat);

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
function build({ title, subtitle, summary = null, findings = [], table = null, quiet = [], footer = null, verdict = null }) {
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

    // 3. SUMMARY - two or three plain sentences: was this normal or not, and
    //    what stands out. A table cannot say "quiet Sunday, nothing unusual",
    //    and that sentence is often the only thing read on a phone.
    if (summary) {
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: summary } });
    }

    // 4. FINDINGS - the only full-width prose besides the summary.
    //    Sorted red-first. Each carries its recommendation via "→".
    if (findings.length) {
        const order = { '🔴': 0, '🟡': 1, '🟢': 2 };
        const shown = findings.slice().sort((a, b) => order[a.dot] - order[b.dot]);
        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: shown.map(f => {
                    let s = `${f.dot}  *${f.what}*`;
                    if (f.soWhat) s += `\n_${f.soWhat}_`;
                    if (f.doWhat) s += `\n→  ${f.doWhat}`;
                    return s;
                }).join('\n\n'),
            },
        });
    }

    // 4. ONE divider. More than one and every section looks equally important.
    if (table) blocks.push({ type: 'divider' });

    // 5. TABLE - plain numbers, no deltas or percentages. Let the eye compare.
    //
    // MOBILE CONSTRAINT: Slack's mobile code block fits ~32 chars before it
    // wraps or shrinks the font to unreadable. Keep every line <= 32.
    // Labels are truncated rather than allowed to push the columns out.
    if (table) {
        const { columns = [], rows = [], label = 'Data', note = null } = table;
        const nCols = columns.length;
        // Budget: 32 total. Give the numbers what they need, label takes the rest.
        const widest = Math.max(
            ...columns.map(c => String(c).length),
            ...rows.flatMap(r => r.slice(1).map(v => num(v).length))
        );
        const colWidth = Math.max(widest + 1, 5);
        const labelWidth = Math.max(9, Math.min(16, 32 - colWidth * nCols));

        const trunc = (s) => {
            s = String(s);
            return s.length > labelWidth - 1 ? s.slice(0, labelWidth - 2) + '…' : s;
        };
        const head = pad('', labelWidth) + columns.map(c => padL(c, colWidth)).join('');
        const body = rows.map(r => pad(trunc(r[0]), labelWidth) + r.slice(1).map(v => padL(num(v), colWidth)).join(''));
        blocks.push({
            type: 'section',
            text: { type: 'mrkdwn', text: `*${label}*${note ? `  _${note}_` : ''}\n\`\`\`\n${head}\n${body.join('\n')}\n\`\`\`` },
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
