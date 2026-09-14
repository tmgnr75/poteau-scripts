/**
 * Backtest the proposed 3/3 game-creation gate:
 *   1. account created < N minutes before its first game
 *   2. signup email on a disposable / non-mainstream domain
 *   3. that game at a flagged venue
 *
 * -> proposal: auto-ban + cancel their games.
 *
 * This ban would fire on an account that has POSTED NOTHING. Every existing
 * auto-ban needs a harvest message, i.e. an act. So the bar here is zero false
 * positives across all history, not "few" -- per the 2026-09-09 audit rule
 * (4 of 7 auto-bans were legitimate organisers).
 *
 * What this prints, in order of what actually decides the question:
 *   A. every account matching 3/3, banned vs not     <- false positives
 *   B. each signal's base rate alone                  <- is the conjunction load-bearing?
 *   C. the 2/3 near-misses                            <- how close legit users get
 *   D. sensitivity to the disposable-domain list      <- how much rests on the list
 *
 * Read-only. Writes nothing.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
const db = admin.firestore();

const { SEED_FLAGGED_VENUES, isFlaggedVenue } = require('../cloud-functions/functions/shared/spamSignature.js');

const FAST_SIGNUP_MINUTES = 30;

// Mainstream consumer providers. Anything NOT here counts as "not widely
// recognised" for signal 2 -- deliberately the broad reading of Tim's proposal,
// so the measurement shows the real blast radius rather than a flattering one.
const MAINSTREAM = new Set([
    'gmail.com', 'googlemail.com',
    'hotmail.com', 'hotmail.fr', 'outlook.com', 'outlook.fr', 'live.com', 'live.fr', 'msn.com',
    'yahoo.com', 'yahoo.fr', 'ymail.com',
    'icloud.com', 'me.com', 'mac.com',
    'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'laposte.net', 'bbox.fr', 'numericable.fr',
    'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.fr', 'mail.com',
    // Apple Hide My Email is NOT disposable: a relay is anchored to one real
    // Apple ID and cannot be minted in bulk, which is the whole point of the
    // signal. Treating it as suspicious would flag ordinary privacy-conscious
    // iOS users -- and 70% of Poteau is iOS.
    'privaterelay.appleid.com', 'icloud.com',
]);

// Known disposable services -- the NARROW reading of signal 2.
const DISPOSABLE_HINTS = [
    'mailinator', 'guerrillamail', 'yopmail', '10minutemail', 'tempmail', 'temp-mail',
    'throwaway', 'trashmail', 'sharklasers', 'maildrop', 'dispostable', 'fakeinbox',
    'getnada', 'mohmal', 'emailondeck', 'mailsac', 'burnermail', 'anonaddy',
    'simplelogin', 'spamgourmet', 'jetable', 'tempr.email', 'discard.email',
    'crybio', 'mail123', 'bltiwd',  // seen on this operator's accounts
];

const isDisposableNarrow = (dom) => DISPOSABLE_HINTS.some((h) => dom.includes(h));
const isNotMainstream = (dom) => !MAINSTREAM.has(dom);

const iso = (d) => d?.toISOString().replace('T', ' ').slice(0, 16) || '?';

async function main() {
    // ---- Load every game with an organizer, keep each organizer's EARLIEST.
    console.log('Loading games...');
    const games = await db.collection('games')
        .select('organizer', 'centre', 'created_on', 'date', 'status', 'attendees', 'max_players')
        .get();
    console.log(`${games.size} games.\n`);

    const firstGame = new Map(); // uid -> game
    games.forEach((doc) => {
        const g = doc.data();
        const uid = g.organizer;
        if (!uid || typeof uid !== 'string') return;
        const created = g.created_on?.toDate?.();
        if (!created) return;
        const prev = firstGame.get(uid);
        if (!prev || created < prev.created) {
            firstGame.set(uid, {
                id: doc.id, created, centre: g.centre || '',
                status: g.status, date: g.date?.toDate?.(),
                attendees: Array.isArray(g.attendees) ? new Set(g.attendees.map((r) => r.id || r)).size : 0,
                max: g.max_players || 0,
            });
        }
    });
    console.log(`${firstGame.size} distinct organizers.\n`);

    // ---- Join against users.
    console.log('Loading users...');
    const users = await db.collection('users')
        .select('email', 'display_name', 'created_time', 'banned', 'phone_number', 'played_games')
        .get();
    console.log(`${users.size} users.\n`);

    const rows = [];
    users.forEach((doc) => {
        const u = doc.data();
        const g = firstGame.get(doc.id);
        if (!g) return;
        const signup = u.created_time?.toDate?.();
        if (!signup) return;

        const gapMin = (g.created - signup) / 60000;
        const dom = (u.email || '').split('@')[1]?.toLowerCase() || '';
        if (!dom) return;

        rows.push({
            uid: doc.id,
            name: u.display_name,
            email: u.email,
            dom,
            banned: u.banned === true,
            signup,
            gapMin,
            game: g,
            played: Array.isArray(u.played_games) ? u.played_games.length : 0,
            fast: gapMin >= 0 && gapMin <= FAST_SIGNUP_MINUTES,
            venue: isFlaggedVenue(g.centre, SEED_FLAGGED_VENUES),
            disp: isDisposableNarrow(dom),
            notMain: isNotMainstream(dom),
        });
    });
    console.log(`${rows.length} organizers with a usable signup+first-game pair.\n`);

    const show = (r) =>
        `   ${r.banned ? 'BANNED ' : '>>CLEAN'} ${r.uid} | ${r.name} | ${r.email}\n` +
        `        signup ${iso(r.signup)} -> game +${r.gapMin.toFixed(0)}min @ "${r.game.centre}"\n` +
        `        game ${r.game.status}, ${r.game.attendees}/${r.game.max} players, played_games=${r.played}`;

    // ================= A. THE PROPOSED GATE =================
    for (const [label, emailTest] of [
        ['NARROW (known disposable services)', (r) => r.disp],
        ['BROAD (any non-mainstream domain)', (r) => r.notMain],
    ]) {
        const hits = rows.filter((r) => r.fast && r.venue && emailTest(r));
        const clean = hits.filter((r) => !r.banned);
        console.log(`\n${'='.repeat(70)}`);
        console.log(`A. 3/3 MATCH -- ${label}`);
        console.log('='.repeat(70));
        console.log(`${hits.length} account(s) would be auto-banned; ${clean.length} of them NOT currently banned.\n`);
        hits.sort((a, b) => a.signup - b.signup).forEach((r) => console.log(show(r) + '\n'));
        // An unbanned hit is NOT automatically a false positive.
        //
        // On 2026-09-14 this printed "1 legitimate account would be banned" for
        // arthurthomas@mail123.pro -- which was in fact the operator, live, two
        // hours into his next re-registration and not yet found. Reading that
        // line literally would have talked us out of the gate on the strength
        // of the gate working.
        //
        // So the verdict never concludes on its own: every clean hit has to be
        // looked at by a human before it counts either way.
        console.log(clean.length === 0
            ? '   VERDICT: zero unbanned hits in all history -> safe to auto-ban.'
            : `   VERDICT: ${clean.length} UNBANNED hit(s) above. Each is either a false\n` +
              '   positive (-> alert only, do not auto-ban) or an operator we have not\n' +
              '   caught yet (-> ban them, the gate is working). Check each one before\n' +
              '   concluding: the two look identical from here.');
    }

    // ================= B. BASE RATES =================
    console.log(`\n${'='.repeat(70)}`);
    console.log('B. EACH SIGNAL ALONE (is the conjunction doing the work?)');
    console.log('='.repeat(70));
    const stat = (name, pred) => {
        const s = rows.filter(pred);
        const b = s.filter((r) => r.banned).length;
        console.log(`${name.padEnd(46)} ${String(s.length).padStart(6)} accts, ${String(b).padStart(4)} banned (${s.length ? (100 * b / s.length).toFixed(1) : '0.0'}%)`);
    };
    stat('fast signup (<=30min)', (r) => r.fast);
    stat('flagged venue', (r) => r.venue);
    stat('disposable domain (narrow)', (r) => r.disp);
    stat('non-mainstream domain (broad)', (r) => r.notMain);
    stat('fast + venue', (r) => r.fast && r.venue);
    stat('fast + disposable(narrow)', (r) => r.fast && r.disp);
    stat('fast + non-mainstream(broad)', (r) => r.fast && r.notMain);
    stat('venue + disposable(narrow)', (r) => r.venue && r.disp);
    stat('ALL THREE (narrow)', (r) => r.fast && r.venue && r.disp);
    stat('ALL THREE (broad)', (r) => r.fast && r.venue && r.notMain);

    // ================= C. NEAR MISSES =================
    console.log(`\n${'='.repeat(70)}`);
    console.log('C. CLEAN ACCOUNTS AT 2/3 (narrow) -- how close do legit users get?');
    console.log('='.repeat(70));
    const near = rows.filter((r) => !r.banned &&
        [r.fast, r.venue, r.disp].filter(Boolean).length === 2);
    console.log(`${near.length} clean account(s) at exactly 2/3.\n`);
    near.sort((a, b) => b.signup - a.signup).slice(0, 15).forEach((r) => {
        const which = [r.fast && 'fast', r.venue && 'venue', r.disp && 'disposable'].filter(Boolean).join('+');
        console.log(show(r) + `\n        matched: ${which}\n`);
    });
    if (near.length > 15) console.log(`   ... and ${near.length - 15} more.`);

    // ================= D. DOMAIN SENSITIVITY =================
    console.log(`\n${'='.repeat(70)}`);
    console.log('D. NON-MAINSTREAM DOMAINS among fast+venue accounts');
    console.log('='.repeat(70));
    const fv = rows.filter((r) => r.fast && r.venue && r.notMain);
    const byDom = new Map();
    fv.forEach((r) => {
        const e = byDom.get(r.dom) || { n: 0, banned: 0 };
        e.n++; if (r.banned) e.banned++;
        byDom.set(r.dom, e);
    });
    [...byDom.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([d, e]) => {
        console.log(`   ${d.padEnd(34)} ${String(e.n).padStart(4)} accts, ${e.banned} banned${e.banned < e.n ? '   <-- has clean users' : ''}`);
    });

    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
