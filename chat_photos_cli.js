#!/usr/bin/env node
/**
 * Command-line entry point for the chat-photo digest.
 *
 * The collection logic lives in chat_photos.js and the upload in
 * slack_files.js; this file only parses flags, opens Firestore, and prints.
 *
 * Usage:
 *   node chat_photos_cli.js                        # yesterday, print only
 *   node chat_photos_cli.js --days=90              # a range back from today
 *   node chat_photos_cli.js --date=2026-09-04      # one specific day
 *   node chat_photos_cli.js --slack                # actually upload to Slack
 *   node chat_photos_cli.js --html=/tmp/x.html     # render a local preview
 *
 * --slack is the only flag that touches Slack. Everything else is safe to run
 * as often as you like: it reads Firestore and prints.
 */

const path = require('path');
const fs = require('fs');

function dep(name) {
    try { return require(name); }
    catch (e) { return require(`/Users/tmgnr/poteau-workspace/cloud-functions/functions/node_modules/${name}`); }
}
const admin = dep('firebase-admin');
const { DateTime } = dep('luxon');

const photos = require('./chat_photos.js');
const { uploadPhotos } = require('./slack_files.js');

const SA_PATH = path.join(__dirname, 'krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const PROJECT = 'krank-club';
const TZ = photos.TZ;

const arg = (k, d) => {
    const v = process.argv.find(a => a.startsWith(`--${k}=`));
    return v ? v.split('=')[1] : d;
};
const SLACK = process.argv.includes('--slack');
const DAYS = Number(arg('days', 0)) || 0;
const DATE = arg('date');
const HTML = arg('html');
const LIMIT = Number(arg('limit', 0)) || 0;

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)), projectId: PROJECT });
}
const db = admin.firestore();

/** Resolve a set of ids to display values, in one batched read per chunk. */
async function resolveAll(collection, ids, pick) {
    const out = {};
    const list = [...ids];
    for (let i = 0; i < list.length; i += 30) {
        const chunk = list.slice(i, i + 30);
        const snaps = await Promise.all(
            chunk.map(id => db.collection(collection).doc(id).get().catch(() => null)));
        snaps.forEach((s, j) => {
            if (s && s.exists) out[chunk[j]] = pick(s.data());
        });
    }
    return out;
}

/**
 * A local preview of the digest.
 *
 * Exists so the layout and the captions can be judged before anything is
 * uploaded to a channel, which is not undoable.
 */
function renderHtml({ digest, label }) {
    const cards = digest.uploads.map(u => `
    <figure>
      <img src="${u.url}" loading="lazy" alt="">
      <figcaption>${u.caption
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/\*(.+?)\*/g, '<strong>$1</strong>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        .replace(/^&gt; /gm, '')
        .replace(/\n/g, '<br>')}</figcaption>
    </figure>`).join('');

    return `<!doctype html><meta charset="utf-8"><title>${label}</title>
<style>
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; background: #f6f7f8;
         margin: 0; padding: 32px; color: #141414; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .count { color: #5b6b73; margin-bottom: 28px; }
  .grid { display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  figure { margin: 0; background: #fff; border-radius: 12px; overflow: hidden;
           box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  img { width: 100%; display: block; background: #eee; }
  figcaption { padding: 12px 14px; font-size: 13px; }
  strong { display: block; margin-bottom: 4px; }
  em { color: #7a8a92; font-style: normal; }
</style>
<h1>${label}</h1>
<div class="count">${digest.total} photos${digest.heldBack ? ` (${digest.heldBack} not shown)` : ''}</div>
<div class="grid">${cards}</div>`;
}

(async () => {
    let START, END, label;

    if (DAYS) {
        END = DateTime.now().setZone(TZ).startOf('day').plus({ days: 1 }).toJSDate();
        START = DateTime.now().setZone(TZ).startOf('day').minus({ days: DAYS - 1 }).toJSDate();
        label = `Last ${DAYS} days in photos`;
    } else {
        const day = DATE
            ? DateTime.fromISO(DATE, { zone: TZ }).startOf('day')
            : DateTime.now().setZone(TZ).startOf('day').minus({ days: 1 });
        START = day.toJSDate();
        END = day.plus({ days: 1 }).toJSDate();
        label = `Yesterday in photos · ${day.toFormat('cccc d LLLL yyyy')}`;
        if (DATE) label = `Photos · ${day.toFormat('cccc d LLLL yyyy')}`;
    }

    console.error(`[chat_photos] scanning ${START.toISOString().slice(0, 10)} → ${END.toISOString().slice(0, 10)}`);

    const { photos: found, authorIds, gameIds } = await photos.fetchDayPhotos(db, START, END);

    if (!found.length) {
        console.log('No chat photos in that window. Nothing to post.');
        process.exit(0);
    }

    const [names, games] = await Promise.all([
        resolveAll('users', authorIds, u => (u.display_name || '').trim() || 'unknown'),
        resolveAll('games', gameIds, g => ({ centre: g.centre, date: g.date ? g.date.toDate() : null })),
    ]);

    // Newest first for a backfill: the most recent photos are the ones worth
    // seeing at the top. A single day stays chronological, as it happened.
    //
    // Reversing the flat list would also reverse WITHIN a message, so a set of
    // three would read "3 of 3, 2 of 3, 1 of 3". Sort by message time
    // descending but keep each message's own photos in the order they were
    // posted, which is the order the person chose them in.
    const ordered = DAYS
        ? [...found].sort((a, b) => {
            const at = a.at ? a.at.getTime() : 0;
            const bt = b.at ? b.at.getTime() : 0;
            if (at !== bt) return bt - at;
            return a.indexInMessage - b.indexInMessage;
        })
        : found;
    const slice = LIMIT ? ordered.slice(0, LIMIT) : ordered;

    // A backfill legitimately wants more than a morning's worth. The daily cap
    // stays the default; --cap raises it for a one-off without redefining what
    // a normal day is allowed to post.
    const CAP = Number(arg('cap', 0)) || photos.MAX_PHOTOS_POSTED;

    const digest = photos.buildDigest({
        photos: slice, names, games, cap: CAP,
        dayLabel: label.replace(/^.*· /, ''),
    });
    if (!digest) { console.log('Nothing to post.'); process.exit(0); }

    // The header's own label wins for a range, which has no single day.
    digest.header[0].text.text = label;

    const totalNoun = digest.total === 1 ? 'photo' : 'photos';
    console.log(`${digest.total} ${totalNoun}, posting ${digest.uploads.length}`);
    digest.uploads.forEach((u, i) => {
        console.log(`\n${i + 1}. ${u.filename}`);
        console.log(u.caption.replace(/\n/g, '\n   '));
    });

    if (HTML) {
        fs.writeFileSync(HTML, renderHtml({ digest, label }));
        console.log(`\nPreview written to ${HTML}`);
    }

    if (SLACK) {
        const channel = process.env.SLACK_NEWSPAPER_CHANNEL_ID || '';
        const res = await uploadPhotos({ channel, header: digest.header, uploads: digest.uploads });
        console.log(`\nSlack: posted ${res.posted}, failed ${res.failed}${res.error ? ` (${res.error})` : ''}`);
        process.exit(res.posted ? 0 : 1);
    } else {
        console.log('\n(--slack not given, nothing was posted)');
    }
    process.exit(0);
})().catch(e => { console.error('ERR', e.stack || e.message); process.exit(1); });
