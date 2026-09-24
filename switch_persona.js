/**
 * SWITCH THE LOGGED-IN ACCOUNT TO A DIFFERENT PERSONA, WITHOUT LOGGING OUT.
 *
 * Usage:
 *   node switch_persona.js --lang en
 *
 * Tim, 2026-09-24: "You could have just renamed the same test accounts."
 *
 * He is right, and the login churn this replaces was expensive. Driving a
 * sign-out and sign-in per persona meant four chances to fail per device, and
 * they did fail: a tap landing on "Continue with Google", an email field that
 * swallowed the start of the password ("...internalPo"), a signup form
 * captured instead of the login form, and a language picker whose row had
 * moved between being measured and being tapped.
 *
 * Renaming avoids every one of those. ONE account stays signed in for the
 * whole session and its display name, city and photo are rewritten between
 * personas -- which is exactly what the app reads to draw a roster.
 *
 * WHAT THIS REWRITES, AND WHY EACH ONE MATTERS
 *
 *   display_name / first_name   the greeting and every roster row
 *   Auth displayName            the greeting reads currentUserDisplayName,
 *                               which falls back to Firebase Auth
 *   last_address                shown on the profile
 *   country / country_code      currency and distance formatting
 *   time_zone                   kickoff rendering
 *
 * The app language itself is still set in-app with the flag picker, since
 * that is the only thing that moves FFLocalizations.
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

const argv = process.argv;
const i = argv.indexOf("--lang");
const LANG = i > -1 ? argv[i + 1] : null;

if (!PERSONAS[LANG]) {
    console.error(`--lang must be one of: ${Object.keys(PERSONAS).join(", ")}`);
    process.exit(1);
}

/**
 * The ONE account that stays signed in. Every persona's fixtures are rebuilt
 * around it, so it is renamed rather than swapped.
 *
 * It is the French persona's viewer account by history; the name is
 * incidental, the uid is what matters.
 */
const ANCHOR_LANG = "fr";

async function main() {
    const p = PERSONAS[LANG];

    // The anchor is whichever account the device is already signed in as: the
    // fr viewer, which every persona's seed then treats as its own viewer.
    const snap = await db.collection("users")
        .where("store_persona", "==", ANCHOR_LANG).get();
    const anchor = snap.docs.find(
        (d) => d.data().display_name === PERSONAS[ANCHOR_LANG].viewer.display ||
               d.data().store_anchor === true
    );
    if (!anchor) throw new Error("no anchor account found");

    const v = p.viewer;
    await anchor.ref.update({
        store_anchor: true,
        display_name: v.display,
        first_name: v.first,
        last_name: v.last,
        nickname: "",
        name_choice: "real_name",
        language: p.lang,
        country: p.country,
        country_code: p.countryCode,
        time_zone: p.timeZone,
        distance_unit: p.countryCode === "US" ? "mi" : "km",
        last_address: p.city,
        last_label: "home",
    });

    // The greeting reads currentUserDisplayName, which falls back to the
    // Firebase Auth profile when the Firestore field is absent. Both are set,
    // so the two can never disagree.
    await auth.updateUser(anchor.id, { displayName: v.display });

    console.log(
        `anchor ${anchor.id.slice(0, 6)}… is now ${v.display} ` +
        `(${p.city}, ${p.currency}, ${p.clock24h ? "24h" : "AM/PM"})`
    );
    console.log(`uid: ${anchor.id}`);
    process.exit(0);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
