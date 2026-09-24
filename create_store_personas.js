/**
 * CREATE THE TEST ACCOUNTS THE STORE SCREENSHOTS NEED.
 *
 * Four personas x (1 viewer + 11 players) = 48 accounts, all flagged
 * `is_test_account`, all named for their city.
 *
 * Usage:
 *   node create_store_personas.js              # dry run, prints the plan
 *   node create_store_personas.js --write      # create
 *   node create_store_personas.js --delete     # remove every account it made
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS: THE POOL WAS THE CONSTRAINT, NOT THE PITCH
 * ---------------------------------------------------------------------------
 *
 * Five-a-side is 5v5, so a store frame must show a TEN player pitch. The first
 * attempt shipped 6-player games because the shared test pool held nine people
 * and a roster may never repeat a uid (a repeat IS a +1 in this schema, so
 * every capacity number would have lied).
 *
 * Shrinking the pitch to fit the pool was the wrong way round. Accounts are
 * free and fake; the format a store listing advertises is not negotiable.
 *
 * ---------------------------------------------------------------------------
 * EACH PERSONA GETS ITS OWN PEOPLE
 * ---------------------------------------------------------------------------
 *
 * A New Yorker must not see "Mehdi A." on a Chelsea Piers roster, and a Roman
 * must not see "Tyler M." at Tre Fontane. Sharing one cast across four cities
 * is the same mistake as sharing one set of venues, one level down.
 *
 * Photos are REUSED across personas on purpose: the nine consented faces
 * (cast-outreach/candidates.csv) are the only ones cleared for a commercial
 * listing, and the four sets are never on screen together. Names and venues
 * localise; faces cannot.
 */
const admin = require("firebase-admin");
const serviceAccount = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
const { PERSONAS } = require("./lib/store_personas");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "krank-club",
});

const db = admin.firestore();
const auth = admin.auth();
const { Timestamp, GeoPoint } = admin.firestore;

const WRITE = process.argv.includes("--write");
const DELETE = process.argv.includes("--delete");

/** Marks every account this script owns, and is the deletion key. */
const TAG = "store_persona";
const EMAIL_DOMAIN = "poteau-store.internal";
const PASSWORD = "PoteauStore!2026";

/**
 * The nine consented faces, reused across all four personas.
 *
 * These are real Poteau users who each agreed to appear in the listing. They
 * are the only faces cleared for commercial use, so the alternative to reusing
 * them is generated faces, which read as synthetic in a grid.
 */
const FACES = [
    "8vZmdIBOZTcqMFMQKltTcfc7ffl1",
    "9si5imsCVUUQ48LF5sc9XFLFtEj1",
    "FkWN1YsfFtP5PwTCxBEpZ9NpMS23",
    "Go2YXYj9FFW6xG28HZNBcrDkIJV2",
    "XXIV4AJNHvPoQKpBXwKOaA7C3Ob2",
    "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1",
    "hQmClsn4bFU79IvwqTJuYrZdOg63",
    "xz7cm07tVlZkt71QsLdmeTSCPYI3",
    "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2",
];
const faceUrl = (i) =>
    "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/" +
    FACES[i % FACES.length] + ".jpg";

/** The viewer's own photo: a back view with no face, supplied by Tim. */
const VIEWER_PHOTO =
    "https://storage.googleapis.com/krank-club.appspot.com/store_shots_520/cast/" +
    "Y3V5WDgZGTWsQ3vSZDvNlu0Uo1D2.jpg";

/** Skill levels, varied deliberately: a roster of identical 5.0s is the most
 *  obviously fake thing on a game sheet. */
const LEVELS = [6.2, 7.1, 5.4, 4.9, 7.4, 5.7, 6.5, 5.9, 6.8, 5.2, 6.0];

function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

/**
 * The user document, in the shape a real onboarded player carries.
 *
 * `last_onboarding_step: complete` matters: anything else and the app routes
 * the account back into onboarding instead of Home.
 */
function userDoc(p, name, first, last, i, isViewer) {
    return {
        uid: null, // filled after createUser
        display_name: name,
        first_name: first,
        last_name: last,
        nickname: "",
        name_choice: "real_name",
        email: null, // filled below
        photo_url: isViewer ? VIEWER_PHOTO : faceUrl(i),
        hash_pic: "",
        phone_number: `+3360000${String(1000 + i).slice(-4)}`,
        type: "user",
        is_test_account: true,
        [TAG]: p.lang,
        banned: false,
        gold_status: false,
        language: p.lang,
        country: p.country,
        country_code: p.countryCode,
        time_zone: p.timeZone,
        distance_unit: p.countryCode === "US" ? "mi" : "km",
        sports: ["soccer", "padel"],
        soccer_skill_level: LEVELS[i % LEVELS.length],
        padel_skill_level: LEVELS[(i + 3) % LEVELS.length],
        soccer_position: "midfielder",
        declared_level: Math.round(LEVELS[i % LEVELS.length]),
        last_onboarding_step: "complete",
        // The viewer's label must read "home", because the games list header
        // renders it: "Soccer near your place", never a city name.
        last_label: "home",
        last_address: p.city,
        last_location: new GeoPoint(0.5153, 25.1911), // the seed venue
        last_radius: 20000,
        games: [],
        friends: [],
        auth_email: false,
        auth_push: true,
        auth_location: true,
        created_time: Timestamp.now(),
        last_activity_date: Timestamp.now(),
        app_version: 520,
    };
}

async function createOne(p, name, i, isViewer) {
    const [first, ...rest] = name.split(" ");
    const last = rest.join(" ");
    const email = `store_${p.lang}_${slug(first)}_${i}@${EMAIL_DOMAIN}`;

    let uid;
    try {
        const u = await auth.createUser({
            email,
            password: PASSWORD,
            displayName: name,
        });
        uid = u.uid;
    } catch (e) {
        if (e.code === "auth/email-already-exists") {
            const u = await auth.getUserByEmail(email);
            uid = u.uid;
            await auth.updateUser(uid, { displayName: name });
        } else {
            throw e;
        }
    }

    const doc = userDoc(p, name, first, last, i, isViewer);
    doc.uid = uid;
    doc.email = email;
    await db.collection("users").doc(uid).set(doc, { merge: true });
    return { uid, name, email, isViewer };
}

async function run() {
    if (DELETE) {
        console.log("deleting every store-persona account\n");
        let n = 0;
        for (const lang of Object.keys(PERSONAS)) {
            const snap = await db.collection("users").where(TAG, "==", lang).get();
            for (const d of snap.docs) {
                try { await auth.deleteUser(d.id); } catch (e) { /* already gone */ }
                await d.ref.delete();
                n += 1;
            }
        }
        console.log(`deleted ${n} account(s)`);
        process.exit(0);
    }

    console.log(`\n${WRITE ? "CREATING" : "DRY RUN"} — store persona accounts\n`);

    const all = {};
    for (const [lang, p] of Object.entries(PERSONAS)) {
        // viewer + 9 men + 2 women = 12, which fills a 5v5 pitch (10) with the
        // viewer on it and two spare for the padel courts.
        const roster = [
            { name: p.viewer.display, viewer: true },
            ...p.men.map((n) => ({ name: n, viewer: false })),
            ...p.women.map((n) => ({ name: n, viewer: false })),
        ];
        console.log(`${lang.toUpperCase()} — ${p.city} (${roster.length} accounts)`);
        console.log(`  viewer: ${p.viewer.display}`);
        console.log(`  men   : ${p.men.join(", ")}`);
        console.log(`  women : ${p.women.join(", ")}`);

        if (!WRITE) { console.log(""); continue; }

        const made = [];
        for (let i = 0; i < roster.length; i++) {
            made.push(await createOne(p, roster[i].name, i, roster[i].viewer));
        }
        all[lang] = made;
        console.log(`  created ${made.length}\n`);
    }

    if (!WRITE) {
        const total = Object.values(PERSONAS)
            .reduce((n, p) => n + 1 + p.men.length + p.women.length, 0);
        console.log(`DRY RUN — nothing written. ${total} accounts would be created.`);
        console.log(`Re-run with --write.\n`);
        process.exit(0);
    }

    require("fs").writeFileSync(
        "/tmp/store_persona_accounts.json", JSON.stringify(all, null, 1));
    console.log("wrote /tmp/store_persona_accounts.json");
    process.exit(0);
}

run().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
