/**
 * Yesterday's chat photos, collected for the #newspaper digest.
 *
 * WHY THIS EXISTS. Chat photos shipped 2026-09-10 and nobody has used them
 * yet in anger — on 2026-09-14, exactly one active user out of 11,289 was on a
 * build that has the feature. The point of the digest is to watch HOW the
 * feature gets used the moment 5.2.0 reaches people, not to measure a number.
 * That is why every photo is carried with its game, its author and the message
 * it was attached to: a contact sheet of bare images would show that photos
 * happen without ever showing what they are FOR.
 *
 * WHY IT IS SEPARATE FROM daily_signals.js. The Daily is a curated list of
 * situations that need a human decision. Photos are not situations — they are
 * ambient evidence, and folding them in would either pad a signals list with
 * an empty section on most mornings or train the reader to scroll past the
 * part that matters. So this posts as its own message, after the Daily, and
 * on a day with no photos it posts NOTHING at all.
 *
 * THE STORAGE PATH IS NOT CHAT-SPECIFIC. Chat photos land in
 * `users/{uid}/uploads/{micros}.{ext}`, the shared per-user upload folder used
 * by avatars and everything else. There is no way to enumerate chat photos
 * from Storage; the `messages` collection is the only record that a given file
 * was posted into a game chat. Hence a Firestore scan, not a bucket listing.
 */

const { DateTime } = require('luxon');

const TZ = 'Europe/Paris';

// No cap by default: a day posts every photo it found.
//
// Volume is 0-2 photos on a normal day (~40 per 90 days as of 2026-09-14), so
// a cap would essentially never bind, and the one thing it would reliably do
// is hide photos on the single most interesting day of the year. A caller that
// wants one passes `cap` to buildDigest — the 90-day backfill does.
//
// When a cap IS passed, the overflow is announced rather than dropped
// silently: an unexplained missing photo reads as a bug.
const MAX_PHOTOS_POSTED = Infinity;

// Firebase Storage download URLs are served through the CDN, a paid Cloudflare
// Worker live since 2026-08-17. Rewriting the host keeps the digest on the
// cached path instead of hitting the origin bucket once per photo per morning.
// Host-based, so only the hostname changes; the path and the `?alt=media`
// token query must survive untouched or the download 403s.
const CDN_HOST = 'cdn.poteau.cloud';
const STORAGE_HOST = 'firebasestorage.googleapis.com';

function toCdn(url) {
    if (typeof url !== 'string' || !url) return '';
    return url.replace(`https://${STORAGE_HOST}/`, `https://${CDN_HOST}/`);
}

/**
 * Filename for a photo in Slack.
 *
 * Slack shows the filename under the image, so it carries the one fact the
 * caption cannot: which game this was, in a form that stays attached to the
 * file if someone saves or forwards it.
 */
function photoFilename({ gameId, index }) {
    return `poteau-${gameId || 'unknown'}-${index}.jpg`;
}

/**
 * Every chat photo written on the target day, newest last.
 *
 * Returns entries shaped for the poster: the CDN URL to fetch, plus the
 * context a reader needs to judge the photo. `author_name` is NEVER set on a
 * human message — only on log lines — so the display name has to come from
 * resolving `author_id`, exactly as fetchDay does in daily_signals.js.
 * Reading author_name here would caption every photo "unknown".
 */
async function fetchDayPhotos(db, START, END) {
    const snap = await db.collection('messages')
        .where('created', '>=', START).where('created', '<', END).get();

    const found = [];
    const authorIds = new Set();
    const gameIds = new Set();

    snap.forEach(d => {
        const m = d.data();
        const pics = Array.isArray(m.pictures) ? m.pictures : [];
        if (pics.length === 0) return;

        // A log line never carries a picture, but a type check costs nothing
        // and keeps a future log format from leaking into the digest.
        if (m.type === 'log') return;

        const gid = m.game_id && m.game_id.id ? m.game_id.id : null;
        const aid = m.author_id && m.author_id.id ? m.author_id.id : null;

        pics.forEach((p, i) => {
            const raw = p && typeof p.picture === 'string' ? p.picture : '';
            if (!raw) return;
            // Register the author and game only once a usable URL has survived.
            // Doing it before this filter counted the author of a message whose
            // every picture was empty, inflating the digest's "N players" line
            // with people who posted nothing visible.
            if (aid) authorIds.add(aid);
            if (gid) gameIds.add(gid);
            found.push({
                url: toCdn(raw),
                gameId: gid,
                authorId: aid,
                // The message the photo rode in on. Often empty: people post a
                // photo with no words, and that is itself worth seeing.
                text: (m.text || '').trim(),
                at: m.created ? m.created.toDate() : null,
                indexInMessage: i,
                ofMessage: pics.length,
            });
        });
    });

    found.sort((a, b) => (a.at ? a.at.getTime() : 0) - (b.at ? b.at.getTime() : 0));
    return { photos: found, authorIds, gameIds };
}

/**
 * One line of context under a photo.
 *
 * Reads as a sentence rather than a field dump, because the digest is read at
 * a glance over coffee: "Le Five Bobigny · 20:30 · Karim" tells you where you
 * are before you read a word of the message.
 */
function captionFor(photo, names, games) {
    const g = photo.gameId ? games[photo.gameId] : null;
    const who = (photo.authorId && names[photo.authorId]) || 'unknown';
    const when = photo.at
        ? DateTime.fromJSDate(photo.at).setZone(TZ).toFormat('HH:mm')
        : '';

    const head = [g && g.centre ? g.centre : 'unknown venue', when, who]
        .filter(Boolean).join('  ·  ');

    const L = [`*${head}*`];

    // Say it explicitly when a photo came with no words. An empty line would
    // read as a rendering bug rather than as the fact it is.
    if (photo.text) {
        L.push(`> ${photo.text.replace(/\s+/g, ' ').slice(0, 300)}`);
    } else {
        L.push('_no message with it_');
    }

    if (photo.ofMessage > 1) {
        L.push(`_${photo.indexInMessage + 1} of ${photo.ofMessage} in one message_`);
    }

    return L.join('\n');
}

/**
 * Build the digest: what to upload, and the header that frames it.
 *
 * Returns null when there are no photos. The caller posts nothing in that
 * case — deliberately, so the channel stays quiet rather than carrying a daily
 * "0 photos" line that teaches the reader to ignore the digest.
 */
function buildDigest({ photos, names, games, dayLabel, cap = MAX_PHOTOS_POSTED }) {
    if (!photos.length) return null;

    const shown = photos.slice(0, cap);
    const heldBack = photos.length - shown.length;

    const gameCount = new Set(photos.map(p => p.gameId).filter(Boolean)).size;
    const peopleCount = new Set(photos.map(p => p.authorId).filter(Boolean)).size;

    const countLine = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`
        + `  ·  ${gameCount} ${gameCount === 1 ? 'game' : 'games'}`
        + `  ·  ${peopleCount} ${peopleCount === 1 ? 'player' : 'players'}`;

    const header = [
        {
            type: 'header',
            text: { type: 'plain_text', text: `Yesterday in photos · ${dayLabel}`, emoji: true },
        },
        { type: 'context', elements: [{ type: 'mrkdwn', text: countLine }] },
    ];

    if (heldBack > 0) {
        header.push({
            type: 'context',
            elements: [{
                type: 'mrkdwn',
                text: `_Showing the first ${shown.length}. ${heldBack} more not posted._`,
            }],
        });
    }

    const uploads = shown.map((p, i) => ({
        url: p.url,
        filename: photoFilename({ gameId: p.gameId, index: i + 1 }),
        caption: captionFor(p, names, games),
    }));

    return { header, uploads, total: photos.length, heldBack };
}

module.exports = {
    fetchDayPhotos,
    buildDigest,
    captionFor,
    photoFilename,
    toCdn,
    MAX_PHOTOS_POSTED,
    TZ,
};
