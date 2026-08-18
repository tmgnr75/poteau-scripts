/**
 * Investigation Script: Double Charge for User mYF3V88JklbHHCnlUCsfhV9B2L92
 * Game: BtHStUor7SpTvR6x6HwQ
 * Payment Intents:
 *   - pi_3ScVSPRtgRDg6WGQ0ndZSwoJ (Dec 9, 2025, 7:17 PM)
 *   - pi_3ScTdcRtgRDg6WGQ1IhyN2YU (Dec 9, 2025, 5:20 PM)
 */
const admin = require("firebase-admin");
const serviceAccount = require('/Users/tmgnr/Downloads/krank-club-firebase-adminsdk-bl4zy-0528b5d049.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const USER_ID = 'mYF3V88JklbHHCnlUCsfhV9B2L92';
const GAME_ID = 'BtHStUor7SpTvR6x6HwQ';
const PI_1 = 'pi_3ScVSPRtgRDg6WGQ0ndZSwoJ'; // 7:17 PM
const PI_2 = 'pi_3ScTdcRtgRDg6WGQ1IhyN2YU'; // 5:20 PM

async function investigate() {
    console.log('='.repeat(80));
    console.log('DOUBLE CHARGE INVESTIGATION');
    console.log('='.repeat(80));
    console.log(`User ID: ${USER_ID}`);
    console.log(`Game ID: ${GAME_ID}`);
    console.log(`Payment Intent 1: ${PI_1} (Dec 9, 7:17 PM)`);
    console.log(`Payment Intent 2: ${PI_2} (Dec 9, 5:20 PM)`);
    console.log('='.repeat(80));
    console.log('');

    // 1. Fetch all payment documents for this user + game
    console.log('1. PAYMENT DOCUMENTS FOR THIS USER + GAME');
    console.log('-'.repeat(80));

    const userRef = db.collection('users').doc(USER_ID);
    const gameRef = db.collection('games').doc(GAME_ID);

    const paymentsSnapshot = await db.collection('payments')
        .where('user_ref', '==', userRef)
        .where('game_ref', '==', gameRef)
        .get();

    console.log(`Found ${paymentsSnapshot.size} payment document(s):\n`);

    const payments = [];
    for (const doc of paymentsSnapshot.docs) {
        const data = doc.data();
        payments.push({
            id: doc.id,
            ...data,
            authorization_date: data.authorization_date?.toDate()
        });
    }

    // Sort by authorization date
    payments.sort((a, b) => (a.authorization_date || 0) - (b.authorization_date || 0));

    for (const p of payments) {
        console.log(`Payment Doc: ${p.id}`);
        console.log(`  Status: ${p.status}`);
        console.log(`  Amount: ${p.amount} ${p.currency}`);
        console.log(`  Payment Intent: ${p.payment_intent_id}`);
        console.log(`  Authorization Date: ${p.authorization_date?.toISOString() || 'N/A'}`);
        console.log(`  Receipt URL: ${p.receipt_url ? 'YES' : 'NO'}`);
        console.log('');
    }

    // 2. Check for payments with specific payment_intent_ids
    console.log('2. SEARCHING FOR SPECIFIC PAYMENT INTENTS');
    console.log('-'.repeat(80));

    for (const pi of [PI_1, PI_2]) {
        const piSnapshot = await db.collection('payments')
            .where('payment_intent_id', '==', pi)
            .get();

        if (piSnapshot.empty) {
            console.log(`Payment Intent ${pi}: NOT FOUND in Firestore`);
        } else {
            console.log(`Payment Intent ${pi}:`);
            for (const doc of piSnapshot.docs) {
                const data = doc.data();
                console.log(`  Doc ID: ${doc.id}`);
                console.log(`  Status: ${data.status}`);
                console.log(`  User: ${data.user_ref?.id}`);
                console.log(`  Game: ${data.game_ref?.id}`);
                console.log(`  Amount: ${data.amount} ${data.currency}`);
                console.log(`  Auth Date: ${data.authorization_date?.toDate().toISOString()}`);
            }
        }
        console.log('');
    }

    // 3. Fetch the game document
    console.log('3. GAME DOCUMENT');
    console.log('-'.repeat(80));

    const gameDoc = await gameRef.get();
    if (gameDoc.exists) {
        const gameData = gameDoc.data();
        console.log(`Game: ${GAME_ID}`);
        console.log(`  Payment Type: ${gameData.payment_type}`);
        console.log(`  Price: ${gameData.price} ${gameData.currency}`);
        console.log(`  Max Players: ${gameData.max_players}`);
        console.log(`  Date: ${gameData.date?.toDate().toISOString()}`);
        console.log(`  Status: ${gameData.status}`);

        // Check teams for this user
        const teams = gameData.teams || [];
        const userSpots = teams.filter(t => t.user_id === USER_ID);
        console.log(`\n  User's spots in teams array: ${userSpots.length}`);
        for (const spot of userSpots) {
            console.log(`    - Status: ${spot.status}, Team: ${spot.team_side}, Plus One: ${spot.plus_one}`);
        }

        // Check attendees for this user
        const attendees = gameData.attendees || [];
        const userAttendees = attendees.filter(ref => ref.id === USER_ID);
        console.log(`\n  User's entries in attendees array: ${userAttendees.length}`);

        // Check payments array on game
        const gamePayments = gameData.payments || [];
        console.log(`\n  Total payment refs on game: ${gamePayments.length}`);
        for (const payRef of gamePayments) {
            const payDoc = await payRef.get();
            if (payDoc.exists) {
                const payData = payDoc.data();
                if (payData.user_ref?.id === USER_ID) {
                    console.log(`    - ${payRef.id}: ${payData.status}, ${payData.amount} ${payData.currency}`);
                }
            }
        }
    } else {
        console.log('Game not found!');
    }

    // 4. Fetch user document
    console.log('\n4. USER DOCUMENT');
    console.log('-'.repeat(80));

    const userDoc = await userRef.get();
    if (userDoc.exists) {
        const userData = userDoc.data();
        console.log(`User: ${USER_ID}`);
        console.log(`  Display Name: ${userData.display_name}`);
        console.log(`  Email: ${userData.email}`);
        console.log(`  Stripe Customer ID: ${userData.stripe_customer_id}`);

        // Check payments array on user
        const userPayments = userData.payments || [];
        console.log(`\n  Total payment refs on user: ${userPayments.length}`);

        // Filter to show payments for this game
        for (const payRef of userPayments) {
            const payDoc = await payRef.get();
            if (payDoc.exists) {
                const payData = payDoc.data();
                if (payData.game_ref?.id === GAME_ID) {
                    console.log(`    - ${payRef.id}: ${payData.status}, ${payData.amount} ${payData.currency}, PI: ${payData.payment_intent_id}`);
                }
            }
        }
    } else {
        console.log('User not found!');
    }

    // 5. Check messages/logs for this game around the time of payments
    console.log('\n5. MESSAGES/LOGS FOR THIS GAME');
    console.log('-'.repeat(80));

    const messagesSnapshot = await db.collection('messages')
        .where('game_id', '==', gameRef)
        .orderBy('created', 'desc')
        .limit(20)
        .get();

    console.log(`Found ${messagesSnapshot.size} messages for this game:\n`);

    for (const doc of messagesSnapshot.docs) {
        const data = doc.data();
        const authorId = data.author_id?.id;
        const created = data.created?.toDate();
        if (authorId === USER_ID) {
            console.log(`  [${created?.toISOString()}] ${data.trigger || data.type} by ${data.author_name}`);
        }
    }

    // 6. Timeline reconstruction
    console.log('\n6. TIMELINE RECONSTRUCTION');
    console.log('-'.repeat(80));

    const events = [];

    // Add payments to timeline
    for (const p of payments) {
        events.push({
            time: p.authorization_date,
            type: 'PAYMENT_CREATED',
            detail: `${p.id} - ${p.status} - ${p.payment_intent_id}`
        });
    }

    // Add messages to timeline (only for this user)
    for (const doc of messagesSnapshot.docs) {
        const data = doc.data();
        if (data.author_id?.id === USER_ID) {
            events.push({
                time: data.created?.toDate(),
                type: 'MESSAGE',
                detail: `${data.trigger || data.type}`
            });
        }
    }

    // Sort by time
    events.sort((a, b) => (a.time || 0) - (b.time || 0));

    console.log('\nChronological events for this user:\n');
    for (const e of events) {
        console.log(`  ${e.time?.toISOString() || 'N/A'}: ${e.type} - ${e.detail}`);
    }

    // 7. Analysis
    console.log('\n7. ANALYSIS');
    console.log('-'.repeat(80));

    const capturedPayments = payments.filter(p => p.status === 'captured');
    const reservedPayments = payments.filter(p => p.status === 'reserved');

    console.log(`\nCaptured payments: ${capturedPayments.length}`);
    console.log(`Reserved payments: ${reservedPayments.length}`);

    if (capturedPayments.length > 1) {
        console.log('\n⚠️  DOUBLE CHARGE CONFIRMED: Multiple captured payments found!');
        console.log('\nPossible causes:');
        console.log('  1. User clicked "Confirm" button multiple times before first payment completed');
        console.log('  2. Network issues caused retry that created duplicate PaymentIntent');
        console.log('  3. No idempotency protection in letsPay function');
        console.log('  4. Both payment flows (via confirmSpots) completed independently');
    }

    const totalCharged = capturedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    console.log(`\nTotal amount charged: ${totalCharged} ${capturedPayments[0]?.currency || 'EUR'}`);
}

investigate()
    .then(() => {
        console.log('\n' + '='.repeat(80));
        console.log('Investigation complete');
        console.log('='.repeat(80));
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
