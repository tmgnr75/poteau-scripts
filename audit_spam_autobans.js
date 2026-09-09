#!/usr/bin/env node
/**
 * Audit accounts the spam automation banned, and tell operators from organizers.
 *
 * Written on 2026-09-09 after onMessageSpamCheck auto-banned Adam Saimi, a
 * 21-month-old organizer, 5 hours before his game. Auditing all 7 auto-bans it
 * had ever made found at least 4 were legitimate. The automation no longer bans
 * (it alerts a human instead), but this stays for two reasons: to re-check any
 * ban a moderator makes by hand, and because the shape of the check is the point.
 *
 * WHAT SEPARATES THE TWO, measured across all 7:
 *
 *   an operator      a real organizer
 *   -----------      ----------------
 *   account days old        months or years old
 *   tenure ~0 days          weeks of continuous activity
 *   games never played      games that actually happened, 10/10
 *   no reports either way   positive reports from other players
 *   ~10 near-identical      months of ordinary football talk
 *     messages, all pitch
 *
 * None of the signals the automation used (a phrase, a venue, a signup gap)
 * appear in that table, which is exactly why they could not do this job.
 *
 * Bans leave no trace in Firestore beyond `banned: true`, so which ACCOUNTS the
 * automation banned can only come from Cloud Function logs (30-day retention).
 * Get the list with:
 *
 *   gcloud logging read \
 *     'resource.labels.service_name="onmessagespamcheck" AND textPayload:"auto-ban"' \
 *     --project=krank-club --limit=100 --freshness=30d \
 *     --format="value(timestamp,textPayload)"
 *
 * Usage:
 *   node audit_spam_autobans.js <uid> [<uid> ...]
 *   node audit_spam_autobans.js --banned-since 2026-08-01   # every banned account
 *
 * Read-only.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const {
    classify, isChatMessage, messageText, hasAnyPhone, looksLikeHarvest,
} = require('../cloud-functions/functions/shared/spamSignature.js');

const ts = (v) => (v && v.toDate ? v.toDate() : null);

async function auditOne(uid) {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) { console.log(`\n${uid}: USER DOC GONE`); return; }
    const d = doc.data();
    const created = ts(d.created_time);
    const ageDays = created ? (Date.now() - created.getTime()) / 86400000 : null;

    const games = await db.collection('games').where('organizer', '==', uid)
        .select('created_on', 'centre', 'date', 'status', 'attendees', 'description').get();
    let first = null, last = null;
    const rows = [];
    games.forEach((g) => {
        const gd = g.data();
        const co = ts(gd.created_on);
        if (co) {
            if (!first || co < first) first = co;
            if (!last || co > last) last = co;
        }
        rows.push({
            id: g.id, centre: gd.centre || '?', date: ts(gd.date), status: gd.status,
            // Deduped: a +1 is the same user reference repeated.
            att: new Set((gd.attendees || []).map((r) => r && r.id).filter(Boolean)).size,
            desc: gd.description || '',
        });
    });
    rows.sort((a, b) => (b.date || 0) - (a.date || 0));

    const msgs = await db.collection('messages')
        .where('author_id', '==', db.collection('users').doc(uid))
        .select('type', 'trigger', 'text', 'text_en', 'created', 'game_id').get();
    const chat = [];
    msgs.forEach((m) => {
        const md = m.data();
        if (!isChatMessage(md)) return;
        chat.push({ text: md.text || '', created: ts(md.created), game: md.game_id?.id });
    });
    chat.sort((a, b) => (b.created || 0) - (a.created || 0));

    const sig = chat.filter((c) => { const x = classify(c.text); return x && x.severity === 'high'; });
    const phones = chat.filter((c) => hasAnyPhone(c.text));
    const harvest = chat.filter((c) => looksLikeHarvest(c.text));
    const tenureDays = created && last ? (last - created) / 86400000 : 0;
    const played = rows.filter((r) => r.status === 'played').length;
    const positive = (d.positive_reports || []).length;

    // A verdict is offered, not asserted: the numbers above it are the evidence,
    // and a human should read them. It exists so a list of 700 banned accounts
    // can be triaged rather than read end to end.
    const looksLegit = tenureDays > 14 || played >= 3 || positive >= 5;
    const verdict = sig.length > 0
        ? 'SIGNATURE HITS — likely a real operator'
        : looksLegit
            ? '⚠️  LOOKS LEGITIMATE — review this ban'
            : 'thin history, no signature hits — inconclusive, read the messages';

    console.log('\n' + '='.repeat(88));
    console.log(`${d.display_name || '(no name)'}  ${uid}`);
    console.log('='.repeat(88));
    console.log(`  ${verdict}`);
    console.log(`  ${d.email || '?'} · ${d.phone_number || 'no phone'} · banned: ${d.banned}`);
    console.log(`  account ${ageDays !== null ? Math.round(ageDays) : '?'}d old · ` +
        `active over ${Math.round(tenureDays)}d · ${games.size} games (${played} played) · ` +
        `${positive} positive / ${(d.no_show_reports || []).length + (d.rude_reports || []).length} negative reports`);
    if (created && first) {
        console.log(`  signup -> first game: ${Math.round((first - created) / 60000)} min ` +
            `(that game was ${first.toISOString().slice(0, 10)})`);
    }
    console.log(`  messages: ${chat.length} · signature hits: ${sig.length} · ` +
        `posted a phone: ${phones.length} · harvest phrasing: ${harvest.length}`);

    console.log(`\n  --- games (newest first) ---`);
    for (const r of rows.slice(0, 10)) {
        console.log(`    ${r.date ? r.date.toISOString().slice(0, 16) : '?'} | ${r.centre} | ` +
            `${r.status} | ${r.att} players`);
        if (r.desc) console.log(`        "${r.desc.replace(/\s+/g, ' ').slice(0, 100)}"`);
    }
    if (rows.length > 10) console.log(`    ...and ${rows.length - 10} more`);

    console.log(`\n  --- messages (newest first) ---`);
    for (const c of chat.slice(0, 20)) {
        console.log(`    ${c.created ? c.created.toISOString().slice(0, 16) : '?'} ` +
            `"${c.text.replace(/\s+/g, ' ').slice(0, 120)}"`);
    }
    if (chat.length > 20) console.log(`    ...and ${chat.length - 20} more`);
}

(async () => {
    const args = process.argv.slice(2);
    if (!args.length) {
        console.log('Usage: node audit_spam_autobans.js <uid> [<uid> ...]');
        console.log('       node audit_spam_autobans.js --banned-since YYYY-MM-DD');
        process.exit(1);
    }

    if (args[0] === '--banned-since') {
        const since = new Date(args[1]);
        if (isNaN(since)) { console.error('Bad date.'); process.exit(1); }
        const snap = await db.collection('users').where('banned', '==', true).get();
        console.log(`${snap.size} banned accounts; auditing those created since ${args[1]}`);
        for (const doc of snap.docs) {
            const c = ts(doc.data().created_time);
            if (c && c >= since) await auditOne(doc.id);
        }
        process.exit(0);
    }

    for (const uid of args) await auditOne(uid);
    process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
