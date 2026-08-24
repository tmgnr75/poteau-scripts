/**
 * Games for testing the four "Joining a game" stories.
 *
 * PRIVATE IS POSSIBLE, and this is why: game_list_widget.dart greys a private
 * game to 50% opacity and REFUSES the tap unless the viewer is on the game or
 * is a FRIEND OF THE ORGANIZER. So a private game Tim can actually join has to
 * be organised by a friend -- this script makes Gina one (both directions;
 * `friends` is not symmetric by itself).
 *
 * Guards match seed_test_matrix.js: VSD39 Dole only, private only, test
 * accounts only. Tagged `join_tests` and flagged is_test_game so the matrix
 * purge clears it.
 */
const admin = require("firebase-admin");
const cert = require("./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json");
admin.initializeApp({ credential: admin.credential.cert(cert) });
const db = admin.firestore();

const WRITE = process.argv.includes("--write");
const TIM = "Wy5RXZJefwOZfAKG4MvOS6raU2f2";
const GINA = "zfIAAxFq6RfVtpAZ9DHUnM5U9nz2";
const MARCO = "ZtuRCmxdPdeE2iMDW7Y0qvAzzGp1";
const LUCIA = "8vZmdIBOZTcqMFMQKltTcfc7ffl1";
const NOAH = "9si5imsCVUUQ48LF5sc9XFLFtEj1";

const CENTRE = "VSD39 Dole";
// THE REAL VSD39 place_id, taken from the matrix seeder's games. A sample
// value from Google's docs was here, which made these games read as a
// DIFFERENT VENUE from every other game at the same centre -- so the
// same-venue exception in the overlap guard never matched and back-to-back
// pairs looked like clashes.
const PLACE_ID = "ChIJeSnd96VNjUcRMB1eWaVkmKs";
const LOC = new admin.firestore.GeoPoint(47.0921, 5.4903);
const TAG = "join_tests";

const at = (h, m, dayOffset = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d;
};

/** `teams` with `filled` taken spots. Never repeats a uid -- a repeat IS a +1. */
function roster(people, max) {
    const spots = [];
    for (let i = 0; i < max; i++) {
        const taken = i < people.length;
        spots.push({
            user_id: taken ? people[i] : "",
            status: taken ? "confirmed" : "open",
            team_side: i % 2 === 0 ? "team_a" : "team_b",
            plus_one: false,
        });
    }
    return spots;
}

const GAMES = [
    {
        key: "free-join",
        note: "FREE · join it -> the joined sheet, calendar, invite",
        date: at(19, 0, 1), duration: 60, max: 6,
        players: [GINA, MARCO, LUCIA], price: 0, paymentType: "on-site",
    },
    {
        key: "paid-inapp",
        note: "PAID IN-APP 12 EUR · the card-hold copy",
        date: at(20, 30, 1), duration: 60, max: 6,
        players: [GINA, MARCO], price: 12, paymentType: "in-app",
    },
    {
        key: "overlap-a",
        note: "OVERLAP PAIR A · Wed 18:00-19:00 · JOIN THIS FIRST",
        date: at(18, 0, 2), duration: 60, max: 6,
        players: [GINA, MARCO, LUCIA], price: 0, paymentType: "on-site",
    },
    {
        key: "overlap-b",
        note: "OVERLAP PAIR B · Wed 18:30-19:30 · joining this must be refused",
        date: at(18, 30, 2), duration: 60, max: 6,
        players: [GINA, NOAH], price: 0, paymentType: "on-site",
    },
];

async function main() {
    // Guard: every rostered uid must be a test account.
    for (const g of GAMES) {
        for (const uid of g.players) {
            const u = await db.collection("users").doc(uid).get();
            if (!u.exists || u.data().is_test_account !== true) {
                throw new Error(`${uid} is not a test account -- refusing to seed`);
            }
        }
    }
    console.log("guards ok: private · VSD39 Dole · test accounts only\n");

    // Purge previous run of THIS script only.
    const old = await db.collection("games").where("seed_tag", "==", TAG).get();
    if (WRITE && !old.empty) {
        await Promise.all(old.docs.map((d) => d.ref.delete()));
        console.log(`purged ${old.size} previous join-test game(s)`);
    }

    // A PRIVATE game is only tappable by a friend of the organizer, so Gina has
    // to be Tim's friend. Written both ways: `friends` is a plain array on each
    // user and nothing makes it symmetric.
    if (WRITE) {
        const timRef = db.collection("users").doc(TIM);
        const ginaRef = db.collection("users").doc(GINA);
        await timRef.update({ friends: admin.firestore.FieldValue.arrayUnion(ginaRef) });
        await ginaRef.update({ friends: admin.firestore.FieldValue.arrayUnion(timRef) });
        console.log("Gina Test <-> Tim are now friends (unlocks private games)\n");
    }

    for (const g of GAMES) {
        const attendees = g.players.map((u) => db.collection("users").doc(u));
        const data = {
            address: `${CENTRE}, Dole`,
            centre: CENTRE,
            place_id: PLACE_ID,
            location: LOC,
            date: g.date,
            end_time: new Date(g.date.getTime() + g.duration * 60000),
            duration: g.duration,
            max_players: g.max,
            attendees,
            teams: roster(g.players, g.max),
            organizer: GINA,
            status: "published",
            visibility: "private",
            sport: "soccer",
            type: "5v5",
            mood: "friendly",
            level: 3,
            price: g.price,
            price_undiscounted: g.price,
            currency: "EUR",
            payment_type: g.paymentType,
            gold_exclusive: false,
            fff_game: false,
            time_zone: "Europe/Paris",
            created_on: new Date(),
            description: g.note,
            interested: [],
            messages: [],
            outsiders: [],
            is_test_game: true,
            seed_tag: TAG,
        };
        if (WRITE) {
            const ref = await db.collection("games").add(data);
            console.log(`  ${g.date.toISOString().slice(0, 16)}  ${g.players.length}/${g.max}  ${g.note}`);
            console.log(`      ${ref.id}`);
        } else {
            console.log(`  [dry] ${g.date.toISOString().slice(0, 16)}  ${g.note}`);
        }
    }

    if (!WRITE) console.log("\ndry run -- pass --write to create");
    else console.log("\ndone. All private, all VSD39 Dole, organiser is a friend.");
    process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
