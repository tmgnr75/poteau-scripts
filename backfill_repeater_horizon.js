/**
 * Backfill the weekly-game horizon for published repeaters.
 *
 * Why this exists: between 12 and 15 Aug 2026 the `scheduleGames` cron died on
 * an undefined `price` inside a single `Promise.all`, so one malformed repeater
 * abandoned every occurrence queued behind it. The horizon stopped being
 * extended platform-wide and 24 published repeaters were left with no future
 * games at all. The cron is fixed and self-healing from now on, but the games
 * it failed to create in those days do not come back on their own for
 * repeaters whose next occurrence has already slipped past.
 *
 * This is a ONE-OFF recovery. It is a faithful port of the occurrence-creation
 * logic in `scheduleGames` (cloud-functions/functions/index.js) so that a
 * backfilled game is indistinguishable from a cron-created one:
 *
 *   - anchors in the repeater's OWN timezone, never the machine's
 *   - dedupes on the LOCAL CALENDAR DAY, so an organizer who nudged a single
 *     occurrence's kickoff time does not get a duplicate beside it
 *   - captain vs pro decides `type` and `payment_type`
 *   - roster inheritance is ORGANIZER-ONLY, and never for a pro repeater
 *     (the 2026-08-16 rule: a pro's weekly slot is an open offer, and even for
 *     a captain, players who joined one week have not joined the next)
 *
 * Default is a DRY RUN. Pass --commit to write.
 *   node backfill_repeater_horizon.js            # preview
 *   node backfill_repeater_horizon.js --commit   # apply
 */

const admin = require('firebase-admin');
const { DateTime } = require('luxon');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: 'krank-club' });
}
const db = admin.firestore();

const COMMIT = process.argv.includes('--commit');
const SCHEDULE_HORIZON_DAYS = 21;

function levelToLevelDeltas(level) {
    const mapping = { 1: ['one_two'], 2: ['three_four'], 3: ['five_six'], 4: ['seven_eight'], 5: ['nine_plus'] };
    return mapping[level] || null;
}

/** Recover a repeater's price from its own games; heal the document. */
async function resolveRepeaterPrice(repeaterRef, data) {
    if (data.price !== undefined && data.price !== null) return data.price;

    const priorGames = await db.collection('games')
        .where('repeater', '==', repeaterRef)
        .orderBy('date', 'desc')
        .limit(5)
        .get();

    const prices = priorGames.docs
        .map(d => d.get('price'))
        .filter(p => p !== undefined && p !== null);

    if (prices.length === 0) {
        console.error(`  ! ${repeaterRef.id} has no price and none of its games carry one — skipping`);
        return null;
    }
    const recovered = prices[0];
    if (COMMIT) await repeaterRef.update({ price: recovered });
    console.log(`  ~ ${repeaterRef.id} price recovered as ${recovered} and written back`);
    return recovered;
}

(async () => {
    console.log(COMMIT ? '=== COMMIT (writing) ===' : '=== DRY RUN (no writes) ===');

    const repeaters = await db.collection('repeaters').where('status', '==', 'published').get();

    let created = 0, skippedExisting = 0, skippedNoPrice = 0, examined = 0;
    const perRepeater = [];

    for (const repeaterDoc of repeaters.docs) {
        const data = repeaterDoc.data();
        const timeZone = data.timeZone;
        const weekday = data.weekday;

        if (!timeZone || !weekday || !data.expectedTime) {
            console.error(`  ! ${repeaterDoc.id} missing timeZone/weekday/expectedTime — skipping`);
            continue;
        }

        // Organizer decides both the game shape and whether a roster may be
        // inherited at all.
        const userSnapshot = await db.collection('users').doc(data.organizer).get();
        const userData = userSnapshot.exists ? userSnapshot.data() : {};
        const isProOrganizer = userData.type === 'pro' || userData.type === 'super_pro';

        // Roster inheritance: captain only, organizer's own spots only.
        let roster = null;
        if (!isProOrganizer) {
            const earliest = await db.collection('games')
                .where('repeater', '==', repeaterDoc.ref)
                .orderBy('date', 'asc')
                .limit(1)
                .get();
            if (!earliest.empty) {
                const g = earliest.docs[0].data();
                const attendees = (g.attendees || []).filter(r => r && r.id === data.organizer);
                const teams = (g.teams || []).map(spot => {
                    if (spot && spot.user_id && spot.user_id !== data.organizer) {
                        const cleared = { ...spot, user_id: '', status: 'open' };
                        for (const k of ['display_name', 'photo_url', 'hash_pic', 'plus_one', 'position']) {
                            if (k in cleared) delete cleared[k];
                        }
                        return cleared;
                    }
                    return spot;
                });
                roster = { teams, attendees };
            }
        }

        const nowInZone = DateTime.now().setZone(timeZone);
        const horizonEnd = nowInZone.plus({ days: SCHEDULE_HORIZON_DAYS });

        let occurrence = nowInZone.set({
            hour: parseInt(data.expectedTime.split(':')[0], 10),
            minute: parseInt(data.expectedTime.split(':')[1], 10),
            second: 0,
            millisecond: 0,
        }).plus({ days: (weekday - nowInZone.weekday + 7) % 7 });

        if (occurrence <= nowInZone) occurrence = occurrence.plus({ weeks: 1 });

        let madeHere = 0;
        for (; occurrence <= horizonEnd; occurrence = occurrence.plus({ weeks: 1 })) {
            examined++;
            const dayStart = occurrence.startOf('day');
            const dayEnd = occurrence.endOf('day');

            const existing = await db.collection('games')
                .where('date', '>=', dayStart.toJSDate())
                .where('date', '<=', dayEnd.toJSDate())
                .where('repeater', '==', repeaterDoc.ref)
                .get();

            if (!existing.empty) { skippedExisting++; continue; }

            const resolvedPrice = await resolveRepeaterPrice(repeaterDoc.ref, data);
            if (resolvedPrice === null) { skippedNoPrice++; continue; }

            const endDate = occurrence.plus({ minutes: data.duration });
            const paymentType = isProOrganizer
                ? (userData.centre_payment_type === 'hybrid'
                    ? (data.paymentType || 'on-site')
                    : userData.centre_payment_type || 'on-site')
                : 'on-site';

            const newGame = {
                address: data.address,
                centre: data.centre,
                date: occurrence.toJSDate(),
                created_on: admin.firestore.Timestamp.now(),
                duration: data.duration,
                end_time: endDate.toJSDate(),
                gold_exclusive: false,
                location: data.location,
                max_players: data.maxPlayers,
                organizer: data.organizer,
                place_id: data.placeId,
                price: resolvedPrice,
                status: 'published',
                repeater: repeaterDoc.ref,
                sport: data.sport || 'soccer',
                currency: userData.centre_currency || 'EUR',
                payment_type: paymentType,
            };

            if (isProOrganizer) newGame.type = 'pro';

            if (data.genderExclusive) newGame.gender_exclusive = data.genderExclusive;
            if (data.fieldType) newGame.field_type = data.fieldType;
            if (data.description) newGame.description = data.description;
            if (data.priceUndiscounted) newGame.price_undiscounted = data.priceUndiscounted;

            if (data.levelDeltas && data.levelDeltas.length > 0) {
                newGame.level_deltas = data.levelDeltas;
            } else if (data.level !== undefined && data.level !== null && data.level !== '') {
                const converted = levelToLevelDeltas(data.level);
                if (converted) newGame.level_deltas = converted;
            }

            if (roster) {
                if (roster.teams) newGame.teams = roster.teams;
                if (roster.attendees) newGame.attendees = roster.attendees;
            }

            if (COMMIT) {
                const ref = await db.collection('games').add(newGame);
                console.log(`  + ${ref.id}  ${data.centre}  ${occurrence.toISO()}  price=${resolvedPrice}`);
            } else {
                console.log(`  + WOULD CREATE  ${data.centre}  ${occurrence.toISO()}  price=${resolvedPrice}`);
            }
            created++; madeHere++;
        }
        if (madeHere > 0) perRepeater.push(`${repeaterDoc.id} (${data.centre}): ${madeHere}`);
    }

    console.log('\n--- summary ---');
    console.log(`published repeaters : ${repeaters.size}`);
    console.log(`occurrences examined: ${examined}`);
    console.log(`already present     : ${skippedExisting}`);
    console.log(`skipped (no price)  : ${skippedNoPrice}`);
    console.log(`${COMMIT ? 'CREATED' : 'would create'}: ${created}`);
    if (perRepeater.length) {
        console.log('\nrepeaters gaining games:');
        perRepeater.forEach(x => console.log(`  ${x}`));
    }
    process.exit(0);
})().catch(e => { console.error('FAILED:', e); process.exit(1); });
