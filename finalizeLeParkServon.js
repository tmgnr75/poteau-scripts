/**
 * Post-creation fixes for the LE PARK Servon pro account.
 *
 * createLeParkServon.js follows createSoccerArena13.js, which turned out to be
 * only half the job: the conventions the other 55 real pro accounts share are
 * applied afterwards, by finalizeSoccerArena13.js. This is the same pass for
 * Le Park.
 *
 *   1. Generate the QR code and store it in `qr_code`. Without it, the poster
 *      generation Cloud Function (index.js ~3244) bails out early and the
 *      centre never gets its printable in-centre poster.
 *   2. Set `auth_email: false`, matching the April 2025 backfill
 *      (authEmailFalseForPros.js) that every older pro got.
 *   3. cached_centres priority 1 -> 2. Partner centres use 2
 *      (see checkAndFixPriorityCentres.js); 1 was copied from a one-off script.
 *   4. Drop `centre_address` from the cached_centres doc. Soccer Arena 13 was
 *      the only one of 1247 entries carrying it, and createLeParkServon.js
 *      reintroduced it here.
 *   5. Build the `alerts_centres` doc immediately instead of waiting for the
 *      scheduled function.
 *
 * ON STEP 5 - why it is done here rather than left alone
 * ------------------------------------------------------
 * `populateAlertsCentres` (index.js ~2100, scheduled daily at 06:23
 * Europe/Paris) creates this doc for every pro on its own, so finalizing
 * Soccer Arena 13 could skip it. But that doc is what powers the "best time
 * slots" view in Poteau Max, and until it exists the centre opens the app to
 * an empty screen with no explanation.
 *
 * That is not a cosmetic wait for Le Park: 645 alerts already target this
 * place_id, spread across all 7 weekdays and 30 time slots. The demand data
 * has existed for a long time. Only the aggregate doc was missing.
 *
 * This script reimplements the same aggregation as the Cloud Function, writing
 * the identical shape (weekday_1..7 x time_HH-MM, all 48 half-hours, zero
 * filled). The scheduled run will simply overwrite it with the same numbers.
 *
 * Idempotent: each step is a no-op if already applied.
 *
 * Run: node finalizeLeParkServon.js          (dry run, writes nothing)
 *      node finalizeLeParkServon.js --write
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

const WRITE = process.argv.includes('--write');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club',
    storageBucket: 'krank-club.appspot.com',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const UID = 'VeBdqhGJRZSOrajilg8pefl2PEk1';
const PLACE_ID = 'ChIJMU8gErUJ5kcRSnpvacKwFtM';
const SHORT_NAME = 'le-park-servon';
const CENTRE_DISPLAY_NAME = 'LE PARK Servon';

function skip(msg) {
    console.log(`      ${msg}`);
}

function act(msg) {
    console.log(`      ${WRITE ? '✏️ ' : '🔍 would'} ${msg}`);
}

async function generateQrCode() {
    console.log('\n[1/5] QR code');
    const userSnap = await db.collection('users').doc(UID).get();
    if (userSnap.get('qr_code')) {
        skip('already set, skipping.');
        return;
    }

    // Matches generate_all_qr_codes.js: same URL shape, same storage path,
    // same long-lived signed URL.
    const url = `https://poteau.app/centre/${SHORT_NAME}`;
    const destination = `posters/${SHORT_NAME}_qr_code.png`;

    act(`generate QR encoding ${url} -> ${destination}`);
    if (!WRITE) return;

    const tmpFile = path.join(os.tmpdir(), `${SHORT_NAME}_qr_code.png`);
    await QRCode.toFile(tmpFile, url, { type: 'png', errorCorrectionLevel: 'H' });
    await bucket.upload(tmpFile, { destination });
    fs.unlinkSync(tmpFile);

    const [signedUrl] = await bucket.file(destination).getSignedUrl({
        action: 'read',
        expires: '01-01-2500',
    });

    await db.collection('users').doc(UID).update({ qr_code: signedUrl });
    skip('stored.');
}

async function setAuthEmail() {
    console.log('\n[2/5] auth_email');
    const userSnap = await db.collection('users').doc(UID).get();
    if (userSnap.get('auth_email') === false) {
        skip('already false, skipping.');
        return;
    }
    act('set auth_email = false');
    if (!WRITE) return;
    await db.collection('users').doc(UID).update({ auth_email: false });
}

async function fixCachedCentre() {
    const ref = db.collection('cached_centres').doc(PLACE_ID);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`cached_centres/${PLACE_ID} does not exist.`);

    console.log('\n[3/5] cached_centres priority');
    if (snap.get('priority') === 2) {
        skip('already 2, skipping.');
    } else {
        act(`set priority ${snap.get('priority')} -> 2`);
        if (WRITE) await ref.update({ priority: 2 });
    }

    console.log('\n[4/5] cached_centres centre_address');
    if (snap.get('centre_address') === undefined) {
        skip('already absent, skipping.');
    } else {
        act('remove centre_address (non-standard: only doc of 1247 with it)');
        if (WRITE) await ref.update({ centre_address: admin.firestore.FieldValue.delete() });
    }
}

/**
 * Mirrors populateAlertsCentres in cloud-functions/functions/index.js (~2100).
 * Any change to the shape there must be reflected here.
 */
function emptyTimeSlots() {
    const timeSlots = {};
    for (let weekday = 1; weekday <= 7; weekday++) {
        const weekdayKey = `weekday_${weekday}`;
        timeSlots[weekdayKey] = {};
        for (let hour = 0; hour < 24; hour++) {
            for (const minutes of ['00', '30']) {
                timeSlots[weekdayKey][`time_${String(hour).padStart(2, '0')}-${minutes}`] = 0;
            }
        }
    }
    return timeSlots;
}

async function populateAlertsCentre() {
    console.log('\n[5/5] alerts_centres');

    const userRef = db.collection('users').doc(UID);
    const existing = await db.collection('alerts_centres').where('user', '==', userRef).get();

    const timeSlots = emptyTimeSlots();
    const uniqueAlertIds = new Set();

    // The Cloud Function reads every alert and filters in memory. Same here:
    // the collection has no index on places.placeId (it is an array of maps).
    const alerts = await db.collection('alerts').get();
    alerts.forEach((alertDoc) => {
        const alertData = alertDoc.data();
        const matchesCentre = (alertData.places || []).some(
            (place) => place.placeId === PLACE_ID || place.centre === CENTRE_DISPLAY_NAME
        );
        if (!matchesCentre) return;

        uniqueAlertIds.add(alertDoc.id);
        (alertData.weekdays || []).forEach((weekday) => {
            const weekdayKey = `weekday_${weekday}`;
            (alertData.times || []).forEach((time) => {
                // '9:00' -> 'time_09-00'
                const [hour, minute] = time.split(':');
                const normalizedTime = `time_${String(hour).padStart(2, '0')}-${minute}`;
                if (timeSlots[weekdayKey] && timeSlots[weekdayKey][normalizedTime] !== undefined) {
                    timeSlots[weekdayKey][normalizedTime]++;
                }
            });
        });
    });

    const totalUniqueAlerts = uniqueAlertIds.size;
    console.log(`      scanned ${alerts.size} alerts, ${totalUniqueAlerts} target this centre.`);

    // Report the top slots so the result is checkable without opening the app.
    const ranked = [];
    const dayNames = ['', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    for (const [weekdayKey, slots] of Object.entries(timeSlots)) {
        for (const [timeKey, count] of Object.entries(slots)) {
            if (count > 0) ranked.push({ weekdayKey, timeKey, count });
        }
    }
    ranked.sort((a, b) => b.count - a.count);
    console.log('      top slots:');
    ranked.slice(0, 8).forEach((s) => {
        const day = dayNames[parseInt(s.weekdayKey.replace('weekday_', ''), 10)];
        const time = s.timeKey.replace('time_', '').replace('-', 'h');
        console.log(`        ${day} ${time} -> ${s.count}`);
    });

    if (!existing.empty) {
        act(`update alerts_centres/${existing.docs[0].id} (total_unique_alerts=${totalUniqueAlerts})`);
        if (!WRITE) return;
        await existing.docs[0].ref.update({
            time_slots: timeSlots,
            total_unique_alerts: totalUniqueAlerts,
            last_edited: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
    }

    act(`create alerts_centres doc (total_unique_alerts=${totalUniqueAlerts})`);
    if (!WRITE) return;

    const ref = await db.collection('alerts_centres').add({
        centre: CENTRE_DISPLAY_NAME,
        place_id: PLACE_ID,
        time_slots: timeSlots,
        total_unique_alerts: totalUniqueAlerts,
        user: userRef,
        last_edited: admin.firestore.FieldValue.serverTimestamp(),
    });
    skip(`created alerts_centres/${ref.id}`);
}

async function main() {
    try {
        console.log(`🔧 Finalizing ${CENTRE_DISPLAY_NAME} (${UID})`);
        console.log(WRITE ? '   MODE: WRITE (this touches production)' : '   MODE: DRY RUN (nothing is written)');

        await generateQrCode();
        await setAuthEmail();
        await fixCachedCentre();
        await populateAlertsCentre();

        console.log(WRITE ? '\n✅ All steps applied.\n' : '\n✅ Dry run complete, nothing written.\n   Re-run with --write to apply.\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main();
