/**
 * Post-creation fixes for the RealFive Pont-à-Mousson pro account.
 *
 * Same pass as finalizeLeParkServon.js. createRealFivePontAMousson.js follows
 * the creation template, which is only half the job: the conventions the other
 * 56 real pro accounts share are applied here.
 *
 *   1. Generate the QR code and store it in `qr_code`. Without it, the poster
 *      generation Cloud Function (index.js ~3244) bails out early and the
 *      centre never gets its printable in-centre poster.
 *   2. Set `auth_email: false`, matching the April 2025 backfill
 *      (authEmailFalseForPros.js) that every older pro got.
 *   3. cached_centres priority 1 -> 2, the value partner centres use
 *      (see checkAndFixPriorityCentres.js).
 *   4. Build the `alerts_centres` doc immediately instead of waiting for the
 *      scheduled function.
 *
 * Step 4 is missing from the Le Park script's numbering only because that one
 * also had to delete a stray `centre_address`. This centre never had one:
 * createRealFivePontAMousson.js deliberately does not write it.
 *
 * ON STEP 4 - why it is done here rather than left alone
 * ------------------------------------------------------
 * `populateAlertsCentres` (index.js ~2100, scheduled daily at 06:23
 * Europe/Paris) creates this doc for every pro on its own. But that doc powers
 * the "best time slots" view in Poteau Max, and until it exists the centre
 * opens the app to an empty screen with no explanation.
 *
 * For Le Park the doc mattered because 645 alerts already pointed at the
 * venue. Here it will be **all zeros**, because no alert targets this place_id
 * yet, and that is expected rather than a failure. Writing it anyway means the
 * screen renders an honest empty state instead of nothing at all, and the doc
 * starts filling the moment the first player sets an alert.
 *
 * This script reimplements the same aggregation as the Cloud Function, writing
 * the identical shape (weekday_1..7 x time_HH-MM, all 48 half-hours, zero
 * filled). The scheduled run will simply overwrite it with the same numbers.
 *
 * Idempotent: each step is a no-op if already applied.
 *
 * Run: node finalizeRealFivePontAMousson.js          (dry run, writes nothing)
 *      node finalizeRealFivePontAMousson.js --write
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

// Filled in by createRealFivePontAMousson.js. Passed with --uid on the first
// run so the value does not have to be pasted into the file.
const PLACE_ID = 'ChIJ6zeXoQXHlEcRJOm0i4shoAg';
const SHORT_NAME = 'realfive-pont-a-mousson';
const CENTRE_DISPLAY_NAME = 'RealFive Pont-à-Mousson';

function resolveUid() {
    const index = process.argv.indexOf('--uid');
    if (index !== -1 && process.argv[index + 1]) return process.argv[index + 1];
    return process.env.REALFIVE_UID || null;
}

function skip(msg) {
    console.log(`      ${msg}`);
}

function act(msg) {
    console.log(`      ${WRITE ? '✏️ ' : '🔍 would'} ${msg}`);
}

async function generateQrCode(uid) {
    console.log('\n[1/4] QR code');
    const userSnap = await db.collection('users').doc(uid).get();
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

    await db.collection('users').doc(uid).update({ qr_code: signedUrl });
    skip('stored.');
}

async function setAuthEmail(uid) {
    console.log('\n[2/4] auth_email');
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.get('auth_email') === false) {
        skip('already false, skipping.');
        return;
    }
    act('set auth_email = false');
    if (!WRITE) return;
    await db.collection('users').doc(uid).update({ auth_email: false });
}

async function fixCachedCentre() {
    const ref = db.collection('cached_centres').doc(PLACE_ID);
    const snap = await ref.get();
    if (!snap.exists) throw new Error(`cached_centres/${PLACE_ID} does not exist.`);

    console.log('\n[3/4] cached_centres priority');
    if (snap.get('priority') === 2) {
        skip('already 2, skipping.');
        return;
    }
    act(`set priority ${snap.get('priority')} -> 2`);
    if (WRITE) await ref.update({ priority: 2 });
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

async function populateAlertsCentre(uid) {
    console.log('\n[4/4] alerts_centres');

    const userRef = db.collection('users').doc(uid);
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
    if (totalUniqueAlerts === 0) {
        console.log('      expected: no player has set an alert on this venue yet.');
        console.log('      the doc is written all-zero so the screen has something to render.');
    }

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
        const uid = resolveUid();
        if (!uid) {
            console.error('Missing uid. Pass it explicitly:');
            console.error('  node finalizeRealFivePontAMousson.js --uid <uid>');
            console.error('It is printed by createRealFivePontAMousson.js --write.');
            process.exit(1);
        }

        const snap = await db.collection('users').doc(uid).get();
        if (!snap.exists) throw new Error(`users/${uid} not found.`);
        if (snap.get('centre_name') !== CENTRE_DISPLAY_NAME) {
            throw new Error(
                `users/${uid} is "${snap.get('centre_name')}", not "${CENTRE_DISPLAY_NAME}". Aborting.`
            );
        }

        console.log(`🔧 Finalizing ${CENTRE_DISPLAY_NAME} (${uid})`);
        console.log(WRITE ? '   MODE: WRITE (this touches production)' : '   MODE: DRY RUN (nothing is written)');

        await generateQrCode(uid);
        await setAuthEmail(uid);
        await fixCachedCentre();
        await populateAlertsCentre(uid);

        console.log(
            WRITE
                ? '\n✅ All steps applied.\n'
                : '\n✅ Dry run complete, nothing written.\n   Re-run with --write to apply.\n'
        );
        process.exit(0);
    } catch (error) {
        console.error('\n❌ FAILED:', error.message);
        console.error(error);
        process.exit(1);
    }
}

main();
