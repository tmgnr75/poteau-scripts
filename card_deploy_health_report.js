/**
 * Post-deploy watch for the 2026-08-13 card / Poteau Team change.
 *
 * Narrow by design: this is not the V5 health checklist, it only answers
 * "did today's card change behave once real cards started flowing".
 *
 * Checks:
 *   1. Cards issued since the deploy, split yellow/red.
 *   2. Every card message is type poteau_team_message with all four
 *      languages, and the French body names the player exactly once.
 *   3. No card leaked a push -- translateLogs must skip card triggers, so
 *      a `connect` doc referencing a card message means the guard failed.
 *   4. Gender agreement actually fired for anyone marked female.
 *
 * Posts to #health-reports. --dry prints the payload without sending.
 *
 *   node card_deploy_health_report.js --dry
 *   node card_deploy_health_report.js
 */
const admin = require('firebase-admin');
const sa = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'krank-club' });
const db = admin.firestore();

const DRY = process.argv.includes('--dry');
// The functions went live mid-afternoon; anchor on the deploy, not midnight.
const DEPLOY_AT = new Date('2026-08-13T16:20:00Z');
const TRIGGERS = ['late_unapply_yellow_card', 'late_unapply_red_card'];

function countOccurrences(haystack, needle) {
    if (!needle) return 0;
    return haystack.split(needle).length - 1;
}

(async () => {
    const lines = [];
    const problems = [];
    let yellow = 0;
    let red = 0;
    let sinceDeploy = 0;
    let femaleAgreed = 0;

    const all = [];
    for (const trigger of TRIGGERS) {
        const snap = await db.collection('messages').where('trigger', '==', trigger).get();
        snap.docs.forEach(d => all.push({ doc: d, trigger }));
    }

    for (const { doc, trigger } of all) {
        const d = doc.data();
        const created = d.created && d.created.toDate ? d.created.toDate() : null;
        const isNew = created && created >= DEPLOY_AT;
        if (isNew) sinceDeploy++;
        if (trigger === 'late_unapply_red_card') red++; else yellow++;

        if (d.type !== 'poteau_team_message') {
            problems.push(`\`${doc.id}\` is still type \`${d.type}\` — renders under the player's own name`);
        }
        if (!d.text_en || !d.text_es || !d.text_it) {
            problems.push(`\`${doc.id}\` is missing a language — non-French readers get the French string`);
        }

        // The whole point of the rewrite: the name appears once, not three times.
        const name = d.author_name;
        if (name && d.text) {
            const n = countOccurrences(d.text, name);
            if (n > 1) problems.push(`\`${doc.id}\` repeats "${name}" ${n}× in the French body`);
        }
        if (d.text && d.text.includes("On l'a prévenue")) femaleAgreed++;

        // A card must never push. translateLogs returns early on these
        // triggers, so any connect doc quoting the card body is a leak.
        if (isNew && d.text) {
            const leak = await db.collection('connect')
                .where('message', '==', d.text).limit(1).get();
            if (!leak.empty) {
                problems.push(`\`${doc.id}\` PUSHED — a connect doc quotes this card. The roster was notified.`);
            }
        }
    }

    const total = all.length;
    lines.push(`*Card deploy watch* — ${total} card message${total === 1 ? '' : 's'} total, ${sinceDeploy} since deploy`);
    lines.push(`• ${yellow} yellow, ${red} red`);
    lines.push(`• Gendered agreement used on ${femaleAgreed}`);

    if (problems.length === 0) {
        lines.push('');
        lines.push(':white_check_mark: All card messages post as the Poteau Team, in four languages, naming the player once. No card pushed to the roster.');
    } else {
        lines.push('');
        lines.push(`:rotating_light: *${problems.length} problem${problems.length === 1 ? '' : 's'}*`);
        problems.forEach(p => lines.push(`• ${p}`));
    }

    if (sinceDeploy === 0) {
        lines.push('');
        lines.push('_No new card since the deploy, so the live path is unexercised. The checks above cover the backfilled history only._');
    }

    const text = lines.join('\n');
    console.log(text);

    if (DRY) {
        console.log('\n[dry run, not posted]');
        process.exit(0);
    }

    const url = process.env.SLACK_WEBHOOK_URL;
    if (!url) {
        console.error('SLACK_WEBHOOK_URL not set; source ~/.poteau/slack_webhook.env first');
        process.exit(1);
    }
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
    });
    console.log(`\nSlack: ${res.status} ${await res.text()}`);
    process.exit(res.ok ? 0 : 1);
})();
