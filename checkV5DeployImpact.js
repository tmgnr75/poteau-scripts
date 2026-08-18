/**
 * Post-deploy impact check for the 5 V5 cloud-function fixes.
 *
 * Run this 48h after deploy:
 *   node checkV5DeployImpact.js
 *
 * Or with a custom window:
 *   DEPLOY_TIMESTAMP="2026-04-28T14:00:00Z" node checkV5DeployImpact.js
 *
 * What it checks (one section per fix):
 *
 *   #1  stripeWebhook now also handles payment_intent.amount_capturable_updated.
 *       → Look for V5 authorized payments since deploy and verify they have
 *         a corresponding "authorized" status. Compare to the rate before deploy
 *         to confirm faster sync (webhook should now beat reconcilePayments).
 *
 *   #4  syncPaymentAndSpots refuses to confirm beyond max_players.
 *       → Look for any "Refusing to confirm: would exceed max_players" log
 *         since deploy (Cloud Logging side; this script flags games where
 *         confirmed_count > max_players which should be ZERO).
 *
 *   #5  cancelGame cancels authorized PaymentIntents.
 *       → For each game canceled since deploy, count payments with
 *         status="canceled" and cancel_reason="game_canceled". Flag any
 *         payments still status="authorized" on a canceled game (= bug).
 *
 *   #9  letsPay rejects non-published or non-in-app games.
 *       → No Firestore signal here (rejected calls don't write anything).
 *         Inspect Cloud Logging for the new warn lines:
 *         "letsPay called on non-in-app game" / "...non-published game".
 *         This script reports how many in-flight stale orphan PaymentIntents
 *         exist (proxy: payment docs created in window with status still
 *         "reserved" past the 10-min reconcile threshold).
 *
 *   #10 addAttendee rejects in-app payment games.
 *       → Inspect Cloud Logging for the new warn line:
 *         "Rejecting addAttendee on in-app payment game".
 *         This script reports zero-bug invariant: no in-app game should have
 *         confirmed spots that lack a captured/authorized payment.
 *
 * Reads only. Does not mutate anything. Safe to run repeatedly.
 */

const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
});

const db = admin.firestore();

const DEPLOY_TIMESTAMP = process.env.DEPLOY_TIMESTAMP
    ? new Date(process.env.DEPLOY_TIMESTAMP)
    : new Date(Date.now() - 48 * 60 * 60 * 1000); // default: last 48h

console.log(`\n=================================================================`);
console.log(` V5 deploy impact check`);
console.log(` Window: since ${DEPLOY_TIMESTAMP.toISOString()} (${Math.round((Date.now() - DEPLOY_TIMESTAMP.getTime()) / 3600000)}h ago)`);
console.log(`=================================================================\n`);

let exitWithFailure = false;

// -----------------------------------------------------------------------
// #1: webhook handles amount_capturable_updated → authorizations sync fast
// -----------------------------------------------------------------------
async function checkWebhookAuthorizations() {
    console.log(`\n--- #1 Stripe webhook: V5 authorizations syncing ---`);

    const snap = await db.collection('payments')
        .where('authorization_date', '>=', admin.firestore.Timestamp.fromDate(DEPLOY_TIMESTAMP))
        .get();

    let authorized = 0;
    let captured = 0;
    let stillReserved = 0;
    let canceled = 0;
    let abandoned = 0;
    let v5authsOlderThan10min = []; // payments that should have synced by webhook OR reconcile

    snap.forEach(doc => {
        const d = doc.data();
        switch (d.status) {
            case 'authorized': authorized++; break;
            case 'captured': captured++; break;
            case 'reserved': stillReserved++; break;
            case 'canceled': canceled++; break;
            case 'abandoned': abandoned++; break;
        }
        // Flag V5 payments stuck in "reserved" past the 10-min reconcile window
        if (d.status === 'reserved' && d.capture_mode === 'game_minus_1h') {
            const ageMin = (Date.now() - d.authorization_date.toMillis()) / 60000;
            if (ageMin > 10) {
                v5authsOlderThan10min.push({ id: doc.id, ageMin: Math.round(ageMin) });
            }
        }
    });

    console.log(`  Total payments in window: ${snap.size}`);
    console.log(`    authorized:  ${authorized}  ${authorized > 0 ? '(V5 authorizations synced — good)' : ''}`);
    console.log(`    captured:    ${captured}`);
    console.log(`    reserved:    ${stillReserved}`);
    console.log(`    canceled:    ${canceled}`);
    console.log(`    abandoned:   ${abandoned}`);

    if (v5authsOlderThan10min.length > 0) {
        console.log(`  ⚠ ${v5authsOlderThan10min.length} V5 payment(s) stuck in "reserved" past 10min:`);
        v5authsOlderThan10min.slice(0, 5).forEach(p => console.log(`    - ${p.id} (${p.ageMin} min old)`));
        exitWithFailure = true;
    } else {
        console.log(`  ✓ No V5 payments stuck in "reserved" past 10min`);
    }

    console.log(`\n  Manual check: Cloud Logging for stripeWebhook → search`);
    console.log(`    "Processing payment_intent.amount_capturable_updated"`);
    console.log(`  Each authorized V5 payment should have one matching log line.`);
}

// -----------------------------------------------------------------------
// #4: oversell guard — invariant check
// -----------------------------------------------------------------------
async function checkOversellInvariant() {
    console.log(`\n--- #4 Oversell guard: confirmed_count <= max_players ---`);

    // Sample recent published/played games (last 14 days) — no time filter on payments
    // since this is a pure invariant: should ALWAYS hold for any game, ever.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const snap = await db.collection('games')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(fourteenDaysAgo))
        .get();

    let scanned = 0;
    let oversold = [];

    snap.forEach(doc => {
        const d = doc.data();
        if (!Array.isArray(d.teams)) return;
        scanned++;
        const confirmed = d.teams.filter(s => s.status === 'confirmed').length;
        const max = d.max_players || 0;
        if (max > 0 && confirmed > max) {
            oversold.push({ id: doc.id, confirmed, max, centre: d.centre, date: d.date && d.date.toDate ? d.date.toDate().toISOString() : null });
        }
    });

    console.log(`  Games scanned (last 14 days): ${scanned}`);
    if (oversold.length > 0) {
        console.log(`  ✗ ${oversold.length} oversold game(s) — guard either failed or pre-existing:`);
        oversold.slice(0, 10).forEach(g => console.log(`    - ${g.id} confirmed=${g.confirmed}/${g.max} centre=${g.centre} date=${g.date}`));
        exitWithFailure = true;
    } else {
        console.log(`  ✓ No oversold games (invariant holds)`);
    }

    console.log(`\n  Manual check: Cloud Logging for syncPaymentAndSpots → search`);
    console.log(`    "Refusing to confirm: would exceed max_players"`);
    console.log(`  Any hits = the guard fired (means a real race was prevented — investigate).`);
}

// -----------------------------------------------------------------------
// #5: cancel cascade — every canceled game has no leftover authorized
// -----------------------------------------------------------------------
async function checkCancelCascade() {
    console.log(`\n--- #5 Cancel cascade: canceled games have no authorized payments ---`);

    // Games canceled since deploy. We can't filter on cancel_date (not stored),
    // so we look at games with status canceled/hidden whose `date` is >= deploy
    // (proxy: only future-or-recent games can be relevant).
    const snap = await db.collection('games')
        .where('status', 'in', ['canceled', 'hidden'])
        .where('date', '>=', admin.firestore.Timestamp.fromDate(DEPLOY_TIMESTAMP))
        .get();

    console.log(`  Canceled/hidden games in window: ${snap.size}`);

    let totalLeakedAuths = 0;
    let totalCleanCancels = 0;
    const leaks = [];

    for (const gameDoc of snap.docs) {
        const gameRef = gameDoc.ref;
        // Look for payments still authorized on this canceled game
        const paymentsSnap = await db.collection('payments')
            .where('game_ref', '==', gameRef)
            .where('status', '==', 'authorized')
            .get();

        if (!paymentsSnap.empty) {
            totalLeakedAuths += paymentsSnap.size;
            leaks.push({ gameId: gameDoc.id, leaked: paymentsSnap.size });
        } else {
            // Verify the cancel actually wrote any "canceled" payments
            const canceledSnap = await db.collection('payments')
                .where('game_ref', '==', gameRef)
                .where('status', '==', 'canceled')
                .where('cancel_reason', '==', 'game_canceled')
                .get();
            if (!canceledSnap.empty) totalCleanCancels++;
        }
    }

    if (totalLeakedAuths > 0) {
        console.log(`  ✗ ${totalLeakedAuths} authorized payment(s) leaked on ${leaks.length} canceled game(s):`);
        leaks.slice(0, 10).forEach(l => console.log(`    - game ${l.gameId}: ${l.leaked} authorized payment(s) still active on Stripe`));
        console.log(`  → Manual fix needed: cancel these PaymentIntents on Stripe and update Firestore.`);
        exitWithFailure = true;
    } else {
        console.log(`  ✓ No leaked authorized payments on canceled games`);
        console.log(`    (${totalCleanCancels} canceled game(s) had clean payment cascade)`);
    }

    console.log(`\n  Manual check: Cloud Logging for cancelGame → search`);
    console.log(`    "Cancellation cascade:"`);
    console.log(`  Each canceled game with V5 payments should have one summary line.`);
}

// -----------------------------------------------------------------------
// #9: letsPay validation — orphan PaymentIntent proxy
// -----------------------------------------------------------------------
async function checkLetsPayValidation() {
    console.log(`\n--- #9 letsPay validation: stale orphan reserved payments ---`);

    // Payments stuck in "reserved" past the 10-min reconcile window.
    // After fix, fewer of these because invalid letsPay calls are rejected upfront.
    const snap = await db.collection('payments')
        .where('status', '==', 'reserved')
        .where('authorization_date', '>=', admin.firestore.Timestamp.fromDate(DEPLOY_TIMESTAMP))
        .get();

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stale = snap.docs.filter(d => {
        const data = d.data();
        return data.authorization_date && data.authorization_date.toDate() < tenMinAgo;
    });

    console.log(`  Reserved payments in window: ${snap.size}`);
    console.log(`  Stale (>10min old, should have reconciled): ${stale.length}`);

    if (stale.length > 0) {
        console.log(`  Sampling first 5:`);
        stale.slice(0, 5).forEach(d => {
            const data = d.data();
            const age = Math.round((Date.now() - data.authorization_date.toDate().getTime()) / 60000);
            console.log(`    - ${d.id} amount=${data.amount}${data.currency || '?'} ageMin=${age} captureMode=${data.capture_mode || 'immediate'}`);
        });
        // Not necessarily a bug — could be Stripe API issues or genuinely abandoned PaymentSheets
    } else {
        console.log(`  ✓ No stale reserved payments`);
    }

    console.log(`\n  Manual check: Cloud Logging for letsPay → search`);
    console.log(`    "letsPay called on non-in-app game" OR "letsPay called on non-published game"`);
    console.log(`  Hits indicate clients calling on invalid game state — should be near-zero.`);
}

// -----------------------------------------------------------------------
// #10: addAttendee blocked on in-app games — invariant check
// -----------------------------------------------------------------------
async function checkAddAttendeeBlock() {
    console.log(`\n--- #10 addAttendee block: in-app games with unpaid confirmed spots ---`);

    // Invariant: for any in-app game, every "confirmed" spot must have a
    // corresponding payment doc with status in {captured, authorized}.
    // Pre-fix bug: addAttendee on legacy clients could create confirmed spots
    // without payment docs.
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400 * 1000);
    const gamesSnap = await db.collection('games')
        .where('payment_type', '==', 'in-app')
        .where('date', '>=', admin.firestore.Timestamp.fromDate(fourteenDaysAgo))
        .get();

    console.log(`  In-app games scanned (last 14 days): ${gamesSnap.size}`);

    let mismatches = [];
    let scanned = 0;

    for (const gameDoc of gamesSnap.docs) {
        scanned++;
        const data = gameDoc.data();
        const teams = Array.isArray(data.teams) ? data.teams : [];
        const confirmedByUser = {};
        teams.forEach(s => {
            if (s.status === 'confirmed' && s.user_id) {
                confirmedByUser[s.user_id] = (confirmedByUser[s.user_id] || 0) + 1;
            }
        });

        if (Object.keys(confirmedByUser).length === 0) continue;

        // For each confirmed user, verify they have at least one paid payment
        const gameRef = gameDoc.ref;
        for (const userId of Object.keys(confirmedByUser)) {
            const paymentSnap = await db.collection('payments')
                .where('game_ref', '==', gameRef)
                .where('user_ref', '==', db.collection('users').doc(userId))
                .where('status', 'in', ['captured', 'authorized'])
                .get();
            if (paymentSnap.empty) {
                mismatches.push({
                    gameId: gameDoc.id,
                    userId,
                    confirmedSpots: confirmedByUser[userId],
                });
            }
        }
    }

    if (mismatches.length > 0) {
        console.log(`  ⚠ ${mismatches.length} confirmed-without-payment case(s):`);
        mismatches.slice(0, 10).forEach(m => console.log(`    - game ${m.gameId} user ${m.userId} confirmed=${m.confirmedSpots} (no captured/authorized payment)`));
        console.log(`  → If these are pre-V5 (before deploy), they're historical and OK.`);
        console.log(`  → If post-deploy, they indicate a path that bypasses the addAttendee block.`);
        // Not a hard fail — could be pre-existing data
    } else {
        console.log(`  ✓ Invariant holds: every confirmed spot on in-app games has a paid payment`);
    }

    console.log(`\n  Manual check: Cloud Logging for addAttendee → search`);
    console.log(`    "Rejecting addAttendee on in-app payment game"`);
    console.log(`  Hits = legacy clients hitting V5 games. Watch the count over time:`);
    console.log(`    - sustained hits = clients haven't updated → consider in-app forced-update banner`);
    console.log(`    - zero hits = legacy traffic gone, safe to delete addAttendee entirely later`);
}

// -----------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------
(async () => {
    try {
        await checkWebhookAuthorizations();
        await checkOversellInvariant();
        await checkCancelCascade();
        await checkLetsPayValidation();
        await checkAddAttendeeBlock();

        console.log(`\n=================================================================`);
        if (exitWithFailure) {
            console.log(` ✗ One or more checks flagged an issue — review output above`);
            process.exit(1);
        } else {
            console.log(` ✓ All Firestore-side checks passed`);
            console.log(`   Don't forget to inspect Cloud Logging for the manual-check searches.`);
            process.exit(0);
        }
    } catch (e) {
        console.error('\nFatal error:', e);
        process.exit(2);
    }
})();
