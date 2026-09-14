/**
 * Upload real image files to Slack.
 *
 * WHY A BOT TOKEN AND NOT THE WEBHOOK. The Daily posts through an incoming
 * webhook, which can only post JSON. A webhook cannot upload a file — there is
 * no endpoint for it and no scope that grants one. Posting image URLs instead
 * was the obvious cheap alternative and is explicitly not what was asked for:
 * Slack's unfurl of a Firebase Storage URL is unreliable (the token query
 * string often defeats it), the previews are small, and they rot the moment a
 * download token is rotated. A real uploaded file is a file: it thumbnails,
 * it opens full screen, it survives.
 *
 * So this uses the Web API with SLACK_BOT_TOKEN — the same app the moderation
 * channels already use. Two things must be true before it works, and neither
 * can be done from code:
 *
 *   1. the app has the `files:write` scope (Slack app config, then reinstall)
 *   2. the bot is in #newspaper (`/invite @Poteau` in the channel)
 *
 * Without (1) every upload returns `missing_scope`; without (2),
 * `not_in_channel`. Both are reported loudly rather than swallowed, because a
 * digest that silently posts nothing is indistinguishable from a quiet day —
 * the same failure the Daily's ledger exists to prevent.
 *
 * THE UPLOAD IS THREE STEPS. `files.upload` was retired by Slack in 2025. The
 * replacement is: ask for a URL, PUT the bytes there, then tell Slack the
 * upload is complete and which channel it belongs to. The file only becomes a
 * visible message at step 3 — and only if `channel_id` is passed there. This
 * is the single most common way to end up with files uploaded to a workspace
 * that nobody can see.
 */

const axios = require('axios');

const SLACK_API = 'https://slack.com/api';

// A chat photo is capped at 720px wide by the picker, so it is small. This
// guard is against a bad URL returning an HTML error page or something huge,
// not against legitimate photos.
const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;

// How many files one files.completeUploadExternal call may carry.
//
// Slack documents no limit, but a 40-file call answers `internal_error`
// reproducibly while small batches succeed. Ten is comfortably under whatever
// the real ceiling is and keeps a failure cheap: one batch is lost, not a
// whole morning's photos.
const COMPLETE_BATCH = 10;

function token() {
    return process.env.SLACK_BOT_TOKEN || '';
}

async function slackApi(method, body, opts = {}) {
    const res = await axios.post(`${SLACK_API}/${method}`, body, {
        headers: {
            Authorization: `Bearer ${token()}`,
            'Content-Type': opts.form
                ? 'application/x-www-form-urlencoded'
                : 'application/json; charset=utf-8',
        },
        timeout: FETCH_TIMEOUT_MS,
    });
    return res.data;
}

/**
 * Download one photo.
 *
 * Returns null rather than throwing: one dead URL must not cost the whole
 * digest. A photo whose file has been deleted is a normal outcome, not an
 * error worth failing a morning over.
 */
async function fetchPhoto(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: FETCH_TIMEOUT_MS,
            maxContentLength: MAX_BYTES,
            // A Storage URL that has lost its token answers 403 with an XML
            // body. Without this, axios would resolve and we would upload the
            // error document as if it were a photo.
            validateStatus: s => s === 200,
        });
        const type = String(res.headers['content-type'] || '');
        if (!type.startsWith('image/')) {
            console.error(`[slack_files] not an image (${type || 'no type'}): ${url.slice(0, 120)}`);
            return null;
        }
        return Buffer.from(res.data);
    } catch (err) {
        console.error(`[slack_files] download failed: ${String(err.message).slice(0, 140)}`);
        return null;
    }
}

/**
 * Upload one file and return its Slack file id, or null.
 *
 * Deliberately does NOT pass channel_id here. Files are completed in a single
 * batch by uploadPhotos so they land as ONE message with one caption block per
 * photo, instead of N separate messages that push the Daily off the screen.
 */
async function uploadOne({ bytes, filename }) {
    const begin = await slackApi(
        'files.getUploadURLExternal',
        new URLSearchParams({ filename, length: String(bytes.length) }).toString(),
        { form: true },
    );

    if (!begin.ok) {
        // missing_scope here means files:write was never granted. Say so in
        // those words: the error name alone sends the reader to the wrong place.
        const hint = begin.error === 'missing_scope'
            ? ' — the Slack app is missing the files:write scope'
            : '';
        console.error(`[slack_files] getUploadURLExternal failed: ${begin.error}${hint}`);
        return null;
    }

    try {
        await axios.post(begin.upload_url, bytes, {
            headers: { 'Content-Type': 'application/octet-stream' },
            timeout: FETCH_TIMEOUT_MS,
        });
    } catch (err) {
        console.error(`[slack_files] PUT to upload_url failed: ${String(err.message).slice(0, 140)}`);
        return null;
    }

    return begin.file_id;
}

/**
 * Upload a batch of photos into one channel as a single message.
 *
 * `header` blocks are posted first as their own message, because
 * completeUploadExternal takes `initial_comment` as plain text and cannot
 * render Block Kit. Doing it the other way round (files first, header after)
 * reads backwards in the channel.
 *
 * Returns { posted, failed } and never throws: the digest failing must not
 * take the Daily down with it, and every failure is already logged in the
 * words a reader can act on.
 */
async function uploadPhotos({ channel, header, uploads }) {
    if (!token()) {
        console.error('[slack_files] SLACK_BOT_TOKEN missing — cannot upload photos');
        return { posted: 0, failed: uploads.length, error: 'no_token' };
    }
    if (!channel) {
        console.error('[slack_files] no channel id — set SLACK_NEWSPAPER_CHANNEL_ID');
        return { posted: 0, failed: uploads.length, error: 'no_channel' };
    }

    if (header && header.length) {
        const head = await slackApi('chat.postMessage', {
            channel,
            text: 'Yesterday in photos',
            blocks: header,
        });
        if (!head.ok) {
            const hint = head.error === 'not_in_channel'
                ? ' — invite the bot to the channel (/invite @Poteau)'
                : '';
            console.error(`[slack_files] header post failed: ${head.error}${hint}`);
            // Keep going. The photos are the point; a missing header is a
            // cosmetic loss, and stopping here would throw the day away.
        }
    }

    const completed = [];
    let failed = 0;

    for (const u of uploads) {
        const bytes = await fetchPhoto(u.url);
        if (!bytes) { failed++; continue; }

        const fileId = await uploadOne({ bytes, filename: u.filename });
        if (!fileId) { failed++; continue; }

        completed.push({ id: fileId, title: u.caption });
    }

    if (!completed.length) {
        console.error(`[slack_files] nothing uploaded (${failed} failed)`);
        return { posted: 0, failed, error: 'all_failed' };
    }

    // Step 3, in batches. channel_id is what turns uploaded bytes into a
    // visible message; without it the files exist in the workspace and appear
    // nowhere.
    //
    // Slack answers `internal_error` when too many files are completed at once
    // — 40 in one call fails reproducibly, with no documented limit and nothing
    // in the error naming size as the cause. Completing in small batches works,
    // so the batch is capped here rather than left for a caller to discover the
    // same way: every file uploads successfully, then the whole day vanishes at
    // the last step.
    let posted = 0;
    let lastError = null;

    for (let i = 0; i < completed.length; i += COMPLETE_BATCH) {
        const batch = completed.slice(i, i + COMPLETE_BATCH);
        const done = await slackApi('files.completeUploadExternal', {
            files: batch,
            channel_id: channel,
        });

        if (!done.ok) {
            const hint = done.error === 'not_in_channel'
                ? ' — invite the bot to the channel (/invite @Poteau)'
                : '';
            console.error(`[slack_files] completeUploadExternal failed: ${done.error}${hint}`);
            lastError = done.error;
            failed += batch.length;
            continue;
        }
        posted += batch.length;
    }

    if (!posted) return { posted: 0, failed, error: lastError || 'complete_failed' };

    const noun = posted === 1 ? 'photo' : 'photos';
    console.error(`[slack_files] posted ${posted} ${noun}, ${failed} failed`);
    return { posted, failed, error: lastError || undefined };
}

module.exports = { uploadPhotos, fetchPhoto, uploadOne, MAX_BYTES };
