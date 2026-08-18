/**
 * How many invitations would a user actually SEE on Home right now?
 *
 * Samples random users and runs Home's own query for each, so the answer is
 * what the screen would render rather than what the collection contains.
 *
 * Home (home_widget.dart ~2043) asks for:
 *   game_invitations
 *     where invitee   == <user>
 *     where status    == 'pending'
 *     where game_date >  now (truncated to the minute)
 *
 * Two corrections applied on top, because the CARD hides things the QUERY
 * cannot (invitation_card_widget.dart):
 *   - a canceled or hidden game renders nothing
 *   - a game whose live date has passed renders nothing (game_date is a
 *     denormalised copy written once at creation and never updated, so a
 *     rescheduled game leaves it stale)
 *
 * So this reports BOTH numbers: what the query returns, and what survives to
 * become a visible card. The gap between them is itself a finding.
 *
 * Usage:
 *   node count_pending_invitations.js            # 1000 users
 *   node count_pending_invitations.js --n 500
 *   node count_pending_invitations.js --active   # only users seen in 90d
 */
const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const args = process.argv.slice(2);
const SAMPLE = parseInt(getArg('--n') || '1000', 10);
const ACTIVE_ONLY = args.includes('--active');

function getArg(flag) {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
}

/**
 * Random-ish user sample.
 *
 * Firestore has no "sample N documents", and reading every user to shuffle
 * would be both slow and expensive. Instead we jump to random document-id
 * boundaries and take a short run from each: ids are effectively uniformly
 * distributed, so many small windows across the keyspace approximates a random
 * sample far better than one contiguous block would.
 */
async function sampleUsers(n) {
    const users = [];
    const seen = new Set();
    const WINDOWS = 40;
    const perWindow = Math.ceil(n / WINDOWS);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let w = 0; w < WINDOWS && users.length < n; w++) {
        const start = alphabet[Math.floor(Math.random() * alphabet.length)]
            + alphabet[Math.floor(Math.random() * alphabet.length)];

        let q = db.collection('users')
            .where(admin.firestore.FieldPath.documentId(), '>=', start)
            .limit(perWindow * 3);

        const snap = await q.get();
        for (const doc of snap.docs) {
            if (users.length >= n) break;
            if (seen.has(doc.id)) continue;

            const d = doc.data();
            // RevenueCat writes junk docs into `users`; they are not people.
            if (doc.id.startsWith('$RCAnonymousID:')) continue;
            // Pros do not see this section at all.
            if (d.type && d.type !== 'player') continue;
            if (d.banned === true) continue;
            if (ACTIVE_ONLY) {
                const last = d.last_activity_date?.toDate?.();
                if (!last) continue;
                const days = (Date.now() - last.getTime()) / 86400000;
                if (days > 90) continue;
            }
            seen.add(doc.id);
            users.push(doc);
        }
    }
    return users.slice(0, n);
}

async function run() {
    console.log(`Sampling ${SAMPLE} ${ACTIVE_ONLY ? 'ACTIVE (90d) ' : ''}player accounts...`);
    const users = await sampleUsers(SAMPLE);
    console.log(`Got ${users.length} users. Counting invitations...\n`);

    const now = new Date();
    now.setSeconds(0, 0);

    // Cache game lookups: a busy game is invited to many users in one sample.
    const gameCache = new Map();
    async function getGame(ref) {
        if (!ref) return null;
        if (gameCache.has(ref.path)) return gameCache.get(ref.path);
        let data = null;
        try {
            const snap = await ref.get();
            data = snap.exists ? snap.data() : null;
        } catch (e) {
            data = null;
        }
        gameCache.set(ref.path, data);
        return data;
    }

    const rows = [];
    let done = 0;

    for (const user of users) {
        const snap = await db.collection('game_invitations')
            .where('invitee', '==', user.ref)
            .where('status', '==', 'pending')
            .where('game_date', '>', now)
            .get();

        const queryCount = snap.size;

        // Now apply what the CARD does on top of the query.
        let visible = 0;
        let staleDate = 0;
        let canceled = 0;
        let missingGame = 0;
        let fromFriend = 0;

        for (const inv of snap.docs) {
            const d = inv.data();
            const game = await getGame(d.game);
            if (!game) { missingGame++; continue; }
            if (game.status === 'canceled' || game.status === 'hidden') { canceled++; continue; }
            const liveDate = game.date?.toDate?.();
            if (!liveDate || liveDate.getTime() < Date.now() - 30 * 60000) { staleDate++; continue; }
            if (d.inviter && d.inviter.id !== 'Team-App') fromFriend++;
            visible++;
        }

        rows.push({ uid: user.id, queryCount, visible, staleDate, canceled, missingGame, fromFriend });
        done++;
        if (done % 100 === 0) console.log(`  ...${done}/${users.length}`);
    }

    report(rows);
    process.exit(0);
}

function percentile(sorted, p) {
    if (!sorted.length) return 0;
    const i = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(i, sorted.length - 1))];
}

function report(rows) {
    const visible = rows.map(r => r.visible).sort((a, b) => a - b);
    const query = rows.map(r => r.queryCount).sort((a, b) => a - b);
    const sum = a => a.reduce((x, y) => x + y, 0);

    const withNone = rows.filter(r => r.visible === 0).length;
    const withAny = rows.length - withNone;

    console.log('\n' + '='.repeat(64));
    console.log(`PENDING INVITATIONS PER USER  (n=${rows.length})`);
    console.log('='.repeat(64));

    console.log('\nWHAT THE USER ACTUALLY SEES (cards rendered on Home)');
    console.log(`  mean            ${(sum(visible) / rows.length).toFixed(1)}`);
    console.log(`  median (p50)    ${percentile(visible, 50)}`);
    console.log(`  p75             ${percentile(visible, 75)}`);
    console.log(`  p90             ${percentile(visible, 90)}`);
    console.log(`  p95             ${percentile(visible, 95)}`);
    console.log(`  p99             ${percentile(visible, 99)}`);
    console.log(`  max             ${visible[visible.length - 1]}`);

    console.log('\nDISTRIBUTION');
    const buckets = [
        ['0        ', r => r.visible === 0],
        ['1        ', r => r.visible === 1],
        ['2-3      ', r => r.visible >= 2 && r.visible <= 3],
        ['4-5      ', r => r.visible >= 4 && r.visible <= 5],
        ['6-10     ', r => r.visible >= 6 && r.visible <= 10],
        ['11-20    ', r => r.visible >= 11 && r.visible <= 20],
        ['21-50    ', r => r.visible >= 21 && r.visible <= 50],
        ['51+      ', r => r.visible > 50],
    ];
    for (const [label, fn] of buckets) {
        const c = rows.filter(fn).length;
        const pct = (c / rows.length) * 100;
        const bar = '#'.repeat(Math.round(pct / 2));
        console.log(`  ${label} ${String(c).padStart(5)}  ${pct.toFixed(1).padStart(5)}%  ${bar}`);
    }

    console.log('\nAMONG USERS WHO HAVE AT LEAST ONE');
    const withSome = rows.filter(r => r.visible > 0).map(r => r.visible).sort((a, b) => a - b);
    if (withSome.length) {
        console.log(`  users           ${withAny} of ${rows.length} (${((withAny / rows.length) * 100).toFixed(1)}%)`);
        console.log(`  mean            ${(sum(withSome) / withSome.length).toFixed(1)}`);
        console.log(`  median          ${percentile(withSome, 50)}`);
        console.log(`  p90             ${percentile(withSome, 90)}`);
        console.log(`  max             ${withSome[withSome.length - 1]}`);
    }

    console.log('\nQUERY RETURNS vs CARDS RENDERED');
    console.log(`  query total     ${sum(query)}`);
    console.log(`  visible total   ${sum(visible)}`);
    const dropped = sum(query) - sum(visible);
    console.log(`  dropped         ${dropped} (${sum(query) ? ((dropped / sum(query)) * 100).toFixed(1) : 0}% of what the query returns)`);
    console.log(`    stale date    ${sum(rows.map(r => r.staleDate))}  (game rescheduled or already played)`);
    console.log(`    canceled      ${sum(rows.map(r => r.canceled))}`);
    console.log(`    game missing  ${sum(rows.map(r => r.missingGame))}`);

    console.log('\nFROM A REAL PERSON (not Team-App)');
    console.log(`  total           ${sum(rows.map(r => r.fromFriend))}`);

    console.log('\nHEAVIEST 10 USERS');
    const top = [...rows].sort((a, b) => b.visible - a.visible).slice(0, 10);
    for (const r of top) {
        console.log(`  ${r.uid}  visible=${String(r.visible).padStart(4)}  query=${String(r.queryCount).padStart(4)}`);
    }
    console.log('');
}

run().catch(e => { console.error(e); process.exit(1); });
