/**
 * Tests for the chat-photo digest collector.
 *
 * These cover the things that would silently produce a wrong or empty digest:
 * the author-name trap, the CDN rewrite, the no-photos case, and the cap.
 */

const assert = require('assert');
const {
    fetchDayPhotos, buildDigest, captionFor, toCdn, MAX_PHOTOS_POSTED,
} = require('../chat_photos.js');

// --- a minimal Firestore double -------------------------------------------

function ref(collection, id) {
    return { id, parent: { id: collection } };
}

function ts(iso) {
    const d = new Date(iso);
    return { toDate: () => d };
}

function fakeDb(docs) {
    return {
        collection: () => ({
            where: function () { return this; },
            get: async () => ({
                size: docs.length,
                forEach: fn => docs.forEach(d => fn({ data: () => d })),
            }),
        }),
    };
}

const START = new Date('2026-09-04T00:00:00Z');
const END = new Date('2026-09-05T00:00:00Z');

// --- toCdn -----------------------------------------------------------------

{
    const raw = 'https://firebasestorage.googleapis.com/v0/b/krank-club.appspot.com/o/users%2Fabc%2Fuploads%2F1.jpg?alt=media&token=xyz';
    const out = toCdn(raw);
    assert.ok(out.startsWith('https://cdn.poteau.cloud/'), 'host is rewritten to the CDN');
    assert.ok(out.includes('?alt=media&token=xyz'), 'the token query survives the rewrite');
    assert.ok(out.includes('users%2Fabc%2Fuploads%2F1.jpg'), 'the encoded path is untouched');
    assert.strictEqual(toCdn(''), '', 'empty url stays empty');
    assert.strictEqual(toCdn(null), '', 'a null url does not throw');
    console.log('ok  toCdn rewrites the host and preserves the token');
}

// --- fetchDayPhotos --------------------------------------------------------

(async () => {
    const docs = [
        // A normal photo message.
        {
            type: 'text', text: 'Belle victoire',
            pictures: [{ picture: 'https://firebasestorage.googleapis.com/a.jpg', hash_pic: 'h' }],
            game_id: ref('games', 'G1'), author_id: ref('users', 'U1'),
            created: ts('2026-09-04T18:30:00Z'),
        },
        // Two photos in one message: both are collected, and both know it.
        {
            type: 'text', text: '',
            pictures: [
                { picture: 'https://firebasestorage.googleapis.com/b.jpg' },
                { picture: 'https://firebasestorage.googleapis.com/c.jpg' },
            ],
            game_id: ref('games', 'G2'), author_id: ref('users', 'U2'),
            created: ts('2026-09-04T19:00:00Z'),
        },
        // No pictures at all: ignored.
        {
            type: 'text', text: 'on est 8',
            game_id: ref('games', 'G1'), author_id: ref('users', 'U3'),
            created: ts('2026-09-04T17:00:00Z'),
        },
        // A log line is never part of the digest even if it somehow carries one.
        {
            type: 'log', text: 'X a rejoint le match.',
            pictures: [{ picture: 'https://firebasestorage.googleapis.com/d.jpg' }],
            game_id: ref('games', 'G1'), author_id: ref('users', 'U4'),
            created: ts('2026-09-04T16:00:00Z'),
        },
        // An empty picture URL must not become an entry.
        {
            type: 'text', text: 'oops',
            pictures: [{ picture: '' }],
            game_id: ref('games', 'G3'), author_id: ref('users', 'U5'),
            created: ts('2026-09-04T20:00:00Z'),
        },
    ];

    const { photos, authorIds, gameIds } = await fetchDayPhotos(fakeDb(docs), START, END);

    assert.strictEqual(photos.length, 3, 'three real photos, log line and empty url excluded');
    assert.ok(photos.every(p => p.url.startsWith('https://cdn.poteau.cloud/')), 'all urls go through the CDN');
    assert.deepStrictEqual([...authorIds].sort(), ['U1', 'U2'], 'only authors of real photos');
    assert.deepStrictEqual([...gameIds].sort(), ['G1', 'G2'], 'only games with real photos');

    // Chronological, so the digest reads like the day did.
    assert.strictEqual(photos[0].gameId, 'G1', 'earliest photo first');
    assert.strictEqual(photos[1].ofMessage, 2, 'a multi-photo message records its size');
    assert.strictEqual(photos[1].indexInMessage, 0, 'first of the pair');
    assert.strictEqual(photos[2].indexInMessage, 1, 'second of the pair');
    console.log('ok  fetchDayPhotos collects only real chat photos, in order');

    // --- captionFor --------------------------------------------------------

    const names = { U1: 'Karim', U2: 'Sofia' };
    const games = { G1: { centre: 'Le Five Bobigny' }, G2: { centre: 'Urban Foot' } };

    const c1 = captionFor(photos[0], names, games);
    assert.ok(c1.includes('Le Five Bobigny'), 'caption names the venue');
    assert.ok(c1.includes('Karim'), 'caption names the player');
    assert.ok(c1.includes('Belle victoire'), 'caption carries the message');

    // The author-name trap: a photo whose author could not be resolved must say
    // "unknown" rather than silently attributing it to nobody.
    const orphan = { ...photos[0], authorId: 'UZZZ' };
    assert.ok(captionFor(orphan, names, games).includes('unknown'), 'unresolved author reads as unknown');

    // A photo with no words says so, rather than rendering a blank line.
    const c2 = captionFor(photos[1], names, games);
    assert.ok(c2.includes('no message with it'), 'a wordless photo is labelled');
    assert.ok(c2.includes('1 of 2'), 'a multi-photo message is labelled');
    console.log('ok  captionFor carries venue, player and message');

    // --- buildDigest -------------------------------------------------------

    assert.strictEqual(buildDigest({ photos: [], names, games, dayLabel: 'x' }), null,
        'no photos means no digest at all, not an empty post');
    console.log('ok  buildDigest posts nothing on a day with no photos');

    const d = buildDigest({ photos, names, games, dayLabel: 'Friday 4 September 2026' });
    assert.strictEqual(d.uploads.length, 3, 'one upload per photo');
    assert.strictEqual(d.heldBack, 0, 'nothing held back under the cap');
    assert.ok(d.header[0].text.text.includes('Friday 4 September 2026'), 'header carries the day');
    const count = d.header[1].elements[0].text;
    assert.ok(count.includes('3 photos') && count.includes('2 games') && count.includes('2 players'),
        `count line reads right: ${count}`);
    assert.ok(d.uploads[0].filename.endsWith('.jpg'), 'filenames are jpg');
    assert.ok(d.uploads[0].filename.includes('G1'), 'filename carries the game id');
    console.log('ok  buildDigest summarises photos, games and players');

    // Singular/plural, because "1 photos · 1 games" is the tell of a template.
    const one = buildDigest({ photos: [photos[0]], names, games, dayLabel: 'x' });
    const oneCount = one.header[1].elements[0].text;
    assert.ok(oneCount.includes('1 photo  ·') && oneCount.includes('1 game  ·') && oneCount.includes('1 player'),
        `singulars are singular: ${oneCount}`);
    console.log('ok  buildDigest gets singular and plural right');

    // By default there is NO cap: a day posts every photo it found. A cap that
    // never binds at 0-2 photos a day would only ever hide photos on the single
    // most interesting day of the year.
    assert.strictEqual(MAX_PHOTOS_POSTED, Infinity, 'the default is uncapped');

    const many = [];
    for (let i = 0; i < 60; i++) {
        many.push({ ...photos[0], gameId: `G${i}`, authorId: 'U1' });
    }
    const uncapped = buildDigest({ photos: many, names, games, dayLabel: 'x' });
    assert.strictEqual(uncapped.uploads.length, 60, 'posts every photo by default');
    assert.strictEqual(uncapped.heldBack, 0, 'nothing held back when uncapped');
    assert.ok(!JSON.stringify(uncapped.header).includes('not posted'),
        'no overflow line when nothing was held back');
    console.log('ok  buildDigest posts every photo by default');

    // An explicit cap (the backfill uses one) holds back the overflow and SAYS
    // so, rather than truncating silently.
    const capped = buildDigest({ photos: many, names, games, dayLabel: 'x', cap: 40 });
    assert.strictEqual(capped.uploads.length, 40, 'an explicit cap is honoured');
    assert.strictEqual(capped.heldBack, 20, 'counts what it held back');
    assert.ok(JSON.stringify(capped.header).includes('20 more not posted'),
        'says how many were held back rather than truncating silently');
    console.log('ok  buildDigest honours an explicit cap and explains the overflow');

    console.log('\nall chat_photos tests passed');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
